/**
 * MockCircleSettlement — default adapter (MOCK=true).
 *
 * Simulates Circle Nanopayments settlement on Arc with a small latency and a
 * fake-but-realistic txRef (0x + 64 hex). No identities are present in the
 * result, mirroring the privacy guarantees of the real flow.
 */
import { randomBytes } from "node:crypto";
import type {
  CircleSettlementPort,
  SettleBatchInput,
  SettleBatchResult,
  WithdrawInput,
  WithdrawResult,
} from "../ports/circle.js";

function fakeTxRef(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

export class MockCircleSettlement implements CircleSettlementPort {
  readonly kind = "mock" as const;

  async settleBatch(input: SettleBatchInput): Promise<SettleBatchResult> {
    // Tiny simulated network/settlement latency so the demo feels real.
    await new Promise((r) => setTimeout(r, 25));
    return {
      txRef: fakeTxRef(),
      settledTotal: input.total,
      itemCount: input.items.length,
    };
  }

  async withdraw(input: WithdrawInput): Promise<WithdrawResult> {
    await new Promise((r) => setTimeout(r, 25));
    return { txRef: fakeTxRef() };
  }
}
