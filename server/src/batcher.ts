/**
 * Per-creator batcher.
 *
 * Tips that pass verification are pushed here, keyed by creator. A single timer
 * fires every BATCH_INTERVAL_MS and flushes every creator that has pending
 * items: it sums them, calls CircleSettlementPort.settleBatch once per creator,
 * and credits the creator's anonymous accrued total.
 *
 * Why this matters for the prize: aggregating N ticks into one settlement breaks
 * the timing correlation between an individual tip and an on-chain event, and
 * the settlement carries no fan identities.
 *
 * TODO (scale): this settles one creator-batch per window. To use full Circle
 * Nanopayments batching, aggregate across creators / rolling windows and submit
 * a single multi-recipient Gateway settlement. See src/adapters/circle.real.ts.
 */
import type { CircleSettlementPort, SettlementItem } from "./ports/circle.js";
import type { CreatorId } from "./contract.js";
import type { Store } from "./store.js";
import { addUsdc, formatUsdc, parseUsdc } from "./usdc.js";

export interface BatcherEvents {
  /** Called after a creator's batch settles, for logging/metrics. */
  onSettled?: (info: {
    creatorId: CreatorId;
    txRef: string;
    total: string;
    itemCount: number;
  }) => void;
  onError?: (info: { creatorId: CreatorId; error: unknown }) => void;
}

export class Batcher {
  private pending = new Map<CreatorId, SettlementItem[]>();
  private timer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(
    private readonly circle: CircleSettlementPort,
    private readonly store: Store,
    private readonly intervalMs: number,
    private readonly events: BatcherEvents = {},
  ) {}

  /** Add a verified tip to its creator's pending batch. Returns new batch size. */
  add(item: SettlementItem): number {
    const list = this.pending.get(item.creatorId) ?? [];
    list.push(item);
    this.pending.set(item.creatorId, list);
    return list.length;
  }

  /** Current pending count for a creator (what the contract calls `batched`). */
  pendingCount(creatorId: CreatorId): number {
    return this.pending.get(creatorId)?.length ?? 0;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.flushAll();
    }, this.intervalMs);
    // Don't keep the event loop alive solely for the batcher.
    this.timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Final drain so nothing is left unsettled on shutdown.
    await this.flushAll();
  }

  /** Settle every creator that currently has pending items. */
  async flushAll(): Promise<void> {
    if (this.flushing) return; // avoid overlapping flushes
    this.flushing = true;
    try {
      const creators = [...this.pending.keys()];
      for (const creatorId of creators) {
        const items = this.pending.get(creatorId);
        if (!items || items.length === 0) continue;
        // Detach the batch so new tips accumulate for the next window.
        this.pending.set(creatorId, []);
        await this.settleOne(creatorId, items);
      }
    } finally {
      this.flushing = false;
    }
  }

  private async settleOne(creatorId: CreatorId, items: SettlementItem[]): Promise<void> {
    const totalMicro = items.reduce((acc, it) => acc + parseUsdc(it.amount), 0n);
    const total = formatUsdc(totalMicro);
    try {
      const res = await this.circle.settleBatch({ creatorId, items, total });
      const creator = this.store.getOrCreateCreator(creatorId);
      creator.accrued = addUsdc(creator.accrued, res.settledTotal);
      creator.settlements += 1;
      this.events.onSettled?.({
        creatorId,
        txRef: res.txRef,
        total: res.settledTotal,
        itemCount: res.itemCount,
      });
    } catch (error) {
      // Re-queue the items so they aren't lost, then surface the error.
      const back = this.pending.get(creatorId) ?? [];
      this.pending.set(creatorId, [...items, ...back]);
      this.events.onError?.({ creatorId, error });
    }
  }
}
