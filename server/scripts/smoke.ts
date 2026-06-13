/**
 * In-process smoke test of the full Ghost Tips flow (MOCK mode).
 *
 * Uses Fastify's app.inject() so it needs no running server or open port. Run:
 *   npm run smoke
 *
 * Covers: /health, onboard, deposit, tip (several ticks + nonce-replay reject +
 * insufficient-funds), me/spent, creator/:id/balance, withdraw.
 */
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

function fakeSig(nonce: number): string {
  // 0x + 130 hex chars, shaped like a real EIP-191 signature (mock only checks shape).
  return "0x" + nonce.toString(16).padStart(130, "a");
}

async function main() {
  // Force a short batch window so settlement happens during the test.
  const { app, batcher } = await buildApp({ mock: true, batchIntervalMs: 300 });
  batcher.start();
  let failures = 0;
  const ok = (label: string) => console.log(`  ok  ${label}`);
  const check = async (label: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      ok(label);
    } catch (e) {
      failures++;
      console.error(`  FAIL ${label}: ${(e as Error).message}`);
    }
  };

  const json = (r: { json: () => unknown }) => r.json() as any;

  // 1. health
  await check("GET /health", async () => {
    const r = await app.inject({ method: "GET", url: "/health" });
    assert.equal(r.statusCode, 200);
    assert.equal(json(r).ok, true);
  });

  // 2. onboard
  let fanAccountId = "";
  await check("POST /api/onboard", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/onboard",
      payload: { dynamicAddress: "0xFan00000000000000000000000000000000000001" },
    });
    assert.equal(r.statusCode, 200);
    fanAccountId = json(r).fanAccountId;
    assert.ok(fanAccountId && typeof fanAccountId === "string", "fanAccountId returned");
    assert.ok(!fanAccountId.includes("0xFan"), "fanAccountId does not leak the address");
  });

  // 3. deposit
  await check("POST /api/deposit", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/deposit",
      payload: { fanAccountId, amount: "1.000000" },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(json(r).ok, true);
    assert.equal(json(r).balance, "1.000000");
  });

  const creatorId = "ghost:alice";

  // 4. tip a few ticks
  await check("POST /api/tip x3 (accepted, batched grows)", async () => {
    for (let nonce = 1; nonce <= 3; nonce++) {
      const r = await app.inject({
        method: "POST",
        url: "/api/tip",
        payload: {
          fanAccountId,
          creatorId,
          amount: "0.002000",
          nonce,
          ts: Date.now(),
          signature: fakeSig(nonce),
        },
      });
      assert.equal(r.statusCode, 200, `tip nonce ${nonce} status`);
      assert.equal(json(r).accepted, true, `tip nonce ${nonce} accepted`);
      assert.equal(json(r).batched, nonce, `batched count == ${nonce}`);
    }
  });

  // 5. nonce replay must be rejected
  await check("POST /api/tip replayed nonce -> 409", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/tip",
      payload: {
        fanAccountId,
        creatorId,
        amount: "0.002000",
        nonce: 2, // <= lastNonce (3)
        ts: Date.now(),
        signature: fakeSig(2),
      },
    });
    assert.equal(r.statusCode, 409);
  });

  // 6. me/spent reflects the 3 accepted ticks
  await check("GET /api/me/spent == 0.006000", async () => {
    const r = await app.inject({
      method: "GET",
      url: `/api/me/spent?fanAccountId=${encodeURIComponent(fanAccountId)}`,
    });
    assert.equal(r.statusCode, 200);
    assert.equal(json(r).total, "0.006000");
  });

  // 7. wait for the batcher to settle, then creator balance should be > 0
  await check("GET /api/creator/:id/balance after settle == 0.006000", async () => {
    await new Promise((res) => setTimeout(res, 500)); // > batchIntervalMs
    const r = await app.inject({
      method: "GET",
      url: `/api/creator/${encodeURIComponent(creatorId)}/balance`,
    });
    assert.equal(r.statusCode, 200);
    assert.equal(json(r).total, "0.006000");
  });

  // 8. insufficient funds path (balance is 1 - 0.006 = 0.994; ask for 2)
  await check("POST /api/tip insufficient funds -> 402", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/tip",
      payload: {
        fanAccountId,
        creatorId,
        amount: "2.000000",
        nonce: 99,
        ts: Date.now(),
        signature: fakeSig(99),
      },
    });
    assert.equal(r.statusCode, 402);
    assert.equal(json(r).accepted, false);
  });

  // 9. withdraw drains the creator's anonymous accrued total
  await check("POST /api/withdraw returns txRef and zeroes balance", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/withdraw",
      payload: { creatorId, toAddress: "0xCreator0000000000000000000000000000000002" },
    });
    assert.equal(r.statusCode, 200);
    assert.ok(/^0x[0-9a-f]{64}$/.test(json(r).txRef), "txRef looks like a tx hash");

    const b = await app.inject({
      method: "GET",
      url: `/api/creator/${encodeURIComponent(creatorId)}/balance`,
    });
    assert.equal(json(b).total, "0.000000");
  });

  await batcher.stop();
  await app.close();

  console.log(failures === 0 ? "\nSMOKE OK — all checks passed" : `\nSMOKE FAILED — ${failures} check(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
