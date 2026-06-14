/**
 * BATCHER AGGREGATION test (TASK 2b).
 *
 * Proves the three behaviours that make the batcher both correct and the source
 * of the privacy/timing win:
 *   1. N tips for the SAME creator collapse into ONE settleBatch call whose total
 *      is the exact sum (this is what breaks per-tick timing correlation).
 *   2. Tips for DIFFERENT creators settle separately (one call each).
 *   3. The error path re-queues items with no loss — a failed settlement does not
 *      silently drop a fan's money.
 *
 * Uses the real Batcher + Store with a tiny fake CircleSettlementPort so we can
 * observe and control settlement. Run with: npm test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { Batcher } from "../src/batcher.js";
import { Store } from "../src/store.js";
import type {
  CircleSettlementPort,
  SettleBatchInput,
} from "../src/ports/circle.js";

/** A controllable settlement port that records calls and can be made to fail. */
function makeRecordingPort(opts: { failOn?: (input: SettleBatchInput) => boolean } = {}) {
  const calls: SettleBatchInput[] = [];
  const port: CircleSettlementPort = {
    kind: "mock",
    async settleBatch(input) {
      calls.push(input);
      if (opts.failOn?.(input)) {
        throw new Error("simulated settlement failure");
      }
      return {
        txRef: "0x" + "a".repeat(64),
        settledTotal: input.total,
        itemCount: input.items.length,
      };
    },
    async withdraw() {
      return { txRef: "0x" + "b".repeat(64) };
    },
  };
  return { port, calls };
}

test("aggregation: N tips for one creator -> ONE settleBatch with summed total", async () => {
  const store = new Store();
  const { port, calls } = makeRecordingPort();
  const batcher = new Batcher(port, store, 10_000);

  const creatorId = "ghost:alice";
  for (let nonce = 1; nonce <= 5; nonce++) {
    batcher.add({ creatorId, amount: "0.002000", nonce, ts: nonce });
  }
  assert.equal(batcher.pendingCount(creatorId), 5, "5 tips pending pre-flush");

  await batcher.flushAll();

  assert.equal(calls.length, 1, "exactly one settleBatch call for the creator");
  assert.equal(calls[0]!.creatorId, creatorId);
  assert.equal(calls[0]!.items.length, 5, "all 5 ticks aggregated");
  assert.equal(calls[0]!.total, "0.010000", "total == 5 * 0.002000");

  // Creator's anonymous accrued total reflects the single settlement.
  assert.equal(store.getOrCreateCreator(creatorId).accrued, "0.010000");
  assert.equal(store.getOrCreateCreator(creatorId).settlements, 1);

  // Batch is drained after flush; a new window starts empty.
  assert.equal(batcher.pendingCount(creatorId), 0);
});

test("aggregation: different creators settle separately (one call each)", async () => {
  const store = new Store();
  const { port, calls } = makeRecordingPort();
  const batcher = new Batcher(port, store, 10_000);

  batcher.add({ creatorId: "ghost:alice", amount: "0.003000", nonce: 1, ts: 1 });
  batcher.add({ creatorId: "ghost:alice", amount: "0.003000", nonce: 2, ts: 2 });
  batcher.add({ creatorId: "ghost:bob", amount: "0.001000", nonce: 1, ts: 3 });

  await batcher.flushAll();

  assert.equal(calls.length, 2, "one settlement per creator");
  const byCreator = new Map(calls.map((c) => [c.creatorId, c]));
  assert.equal(byCreator.get("ghost:alice")!.total, "0.006000");
  assert.equal(byCreator.get("ghost:bob")!.total, "0.001000");

  assert.equal(store.getOrCreateCreator("ghost:alice").accrued, "0.006000");
  assert.equal(store.getOrCreateCreator("ghost:bob").accrued, "0.001000");
});

test("error path: a failed settlement re-queues items with NO loss", async () => {
  const store = new Store();
  // Fail the FIRST attempt only; succeed afterwards.
  let attempts = 0;
  const { port, calls } = makeRecordingPort({
    failOn: () => attempts++ === 0,
  });
  let errorSeen = false;
  const batcher = new Batcher(port, store, 10_000, {
    onError: () => {
      errorSeen = true;
    },
  });

  const creatorId = "ghost:alice";
  batcher.add({ creatorId, amount: "0.002000", nonce: 1, ts: 1 });
  batcher.add({ creatorId, amount: "0.002000", nonce: 2, ts: 2 });

  // First flush: settlement throws, items must be re-queued (not lost).
  await batcher.flushAll();
  assert.ok(errorSeen, "onError fired on the failed settlement");
  assert.equal(calls.length, 1, "one (failed) attempt so far");
  assert.equal(
    batcher.pendingCount(creatorId),
    2,
    "both items re-queued after failure (no loss)",
  );
  assert.equal(
    store.getOrCreateCreator(creatorId).accrued,
    "0.000000",
    "nothing credited on a failed settlement",
  );

  // Second flush: now succeeds and the full amount lands.
  await batcher.flushAll();
  assert.equal(calls.length, 2, "retried after re-queue");
  assert.equal(calls[1]!.total, "0.004000", "retry carries the full re-queued total");
  assert.equal(batcher.pendingCount(creatorId), 0, "drained after success");
  assert.equal(store.getOrCreateCreator(creatorId).accrued, "0.004000");
});
