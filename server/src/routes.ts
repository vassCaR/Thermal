/**
 * HTTP routes — implement the FROZEN shared contract (shared/api.ts) exactly.
 *
 *   POST /api/onboard          OnboardReq        -> OnboardRes
 *   POST /api/deposit          DepositReq        -> DepositRes
 *   POST /api/tip              TipAuthorization  -> TipRes
 *   GET  /api/me/spent         ?fanAccountId=    -> SpentRes
 *   GET  /api/creator/:id/balance                -> CreatorBalanceRes
 *   POST /api/withdraw         WithdrawReq       -> WithdrawRes
 *   GET  /health                                 -> { ok: true }
 */
import type { FastifyInstance } from "fastify";
import type { Adapters } from "./adapters/index.js";
import type { Batcher } from "./batcher.js";
import type { Config } from "./config.js";
import type {
  DepositReq,
  DepositRes,
  OnboardReq,
  OnboardRes,
  SpentRes,
  TipAuthorization,
  TipRes,
  WithdrawReq,
  WithdrawRes,
  CreatorBalanceRes,
} from "./contract.js";
import type { Store } from "./store.js";
import {
  addUsdc,
  gteUsdc,
  isPositiveUsdc,
  parseUsdc,
  subUsdc,
} from "./usdc.js";
import { verifyPresence } from "./verify.js";

export interface Deps {
  cfg: Config;
  store: Store;
  adapters: Adapters;
  batcher: Batcher;
}

/** Validate a USDC string up-front so handlers can assume it's well-formed. */
function badUsdc(value: unknown): string | null {
  if (typeof value !== "string") return "amount must be a string";
  try {
    parseUsdc(value);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  const { store, adapters, batcher } = deps;

  app.get("/health", async () => ({ ok: true as const }));

  // POST /api/onboard {dynamicAddress} -> {fanAccountId}
  app.post<{ Body: OnboardReq }>("/api/onboard", async (req, reply) => {
    const { dynamicAddress } = req.body ?? ({} as OnboardReq);
    if (typeof dynamicAddress !== "string" || dynamicAddress.length === 0) {
      return reply.code(400).send({ error: "dynamicAddress is required" });
    }
    const { fanAccountId } = await adapters.unlink.registerFan({ dynamicAddress });
    store.createFan(fanAccountId);
    const res: OnboardRes = { fanAccountId };
    return res;
  });

  // POST /api/deposit {fanAccountId, amount} -> {ok, balance}
  app.post<{ Body: DepositReq }>("/api/deposit", async (req, reply) => {
    const { fanAccountId, amount } = req.body ?? ({} as DepositReq);
    if (typeof fanAccountId !== "string") {
      return reply.code(400).send({ error: "fanAccountId is required" });
    }
    const amtErr = badUsdc(amount);
    if (amtErr) return reply.code(400).send({ error: amtErr });
    if (!isPositiveUsdc(amount)) {
      return reply.code(400).send({ error: "amount must be > 0" });
    }
    const fan = store.getFan(fanAccountId);
    if (!fan) return reply.code(404).send({ error: "unknown fanAccountId" });

    // NOTE: deposits into the shielded pool are PUBLIC on-chain in the real
    // Unlink flow. In mock mode we just credit the in-memory balance.
    fan.balance = addUsdc(fan.balance, amount);
    const res: DepositRes = { ok: true, balance: fan.balance };
    return res;
  });

  // POST /api/tip (TipAuthorization) -> {accepted, batched}
  app.post<{ Body: TipAuthorization }>("/api/tip", async (req, reply) => {
    const auth = req.body ?? ({} as TipAuthorization);
    if (
      typeof auth.fanAccountId !== "string" ||
      typeof auth.creatorId !== "string" ||
      !Number.isInteger(auth.nonce) ||
      auth.nonce < 0 ||
      !Number.isInteger(auth.ts) ||
      auth.ts < 0
    ) {
      return reply.code(400).send({ error: "malformed TipAuthorization" });
    }
    const amtErr = badUsdc(auth.amount);
    if (amtErr) return reply.code(400).send({ error: amtErr });
    if (!isPositiveUsdc(auth.amount)) {
      return reply.code(400).send({ error: "tip amount must be > 0" });
    }

    const fan = store.getFan(auth.fanAccountId);
    if (!fan) return reply.code(404).send({ error: "unknown fanAccountId" });

    // Anti-replay: nonce must be strictly monotonic per fan.
    if (auth.nonce <= fan.lastNonce) {
      return reply
        .code(409)
        .send({ error: `nonce must be > ${fan.lastNonce}`, batched: 0 });
    }

    // Signature check (presence-only in mock; see src/verify.ts for real mode).
    const sig = verifyPresence(auth);
    if (!sig.ok) return reply.code(401).send({ error: sig.reason });

    // Funds check against the fan's own (private) balance.
    if (!gteUsdc(fan.balance, auth.amount)) {
      const res: TipRes = { accepted: false, batched: batcher.pendingCount(auth.creatorId) };
      return reply.code(402).send(res);
    }

    // Commit: debit balance, bump spend + nonce, push into the per-creator batch.
    fan.balance = subUsdc(fan.balance, auth.amount);
    fan.spent = addUsdc(fan.spent, auth.amount);
    fan.lastNonce = auth.nonce;

    // Note: fanAccountId is intentionally NOT forwarded to settlement (privacy).
    const batched = batcher.add({
      creatorId: auth.creatorId,
      amount: auth.amount,
      nonce: auth.nonce,
      ts: auth.ts,
    });

    const res: TipRes = { accepted: true, batched };
    return res;
  });

  // GET /api/me/spent?fanAccountId=... -> {total}  (fan-only view)
  app.get<{ Querystring: { fanAccountId?: string } }>(
    "/api/me/spent",
    async (req, reply) => {
      const fanAccountId = req.query.fanAccountId;
      if (typeof fanAccountId !== "string" || fanAccountId.length === 0) {
        return reply.code(400).send({ error: "fanAccountId query param is required" });
      }
      const fan = store.getFan(fanAccountId);
      if (!fan) return reply.code(404).send({ error: "unknown fanAccountId" });
      const res: SpentRes = { total: fan.spent };
      return res;
    },
  );

  // GET /api/creator/:creatorId/balance -> {total}  (anonymous; NO fan identities)
  app.get<{ Params: { creatorId: string } }>(
    "/api/creator/:creatorId/balance",
    async (req) => {
      const { creatorId } = req.params;
      // getOrCreate so a brand-new creator simply shows 0.000000 (no 404 churn
      // for the demo). The record carries an anonymous total only.
      const creator = store.getOrCreateCreator(creatorId);
      const res: CreatorBalanceRes = { total: creator.accrued };
      return res;
    },
  );

  // POST /api/withdraw {creatorId, toAddress} -> {txRef}
  app.post<{ Body: WithdrawReq }>("/api/withdraw", async (req, reply) => {
    const { creatorId, toAddress } = req.body ?? ({} as WithdrawReq);
    if (typeof creatorId !== "string" || typeof toAddress !== "string") {
      return reply.code(400).send({ error: "creatorId and toAddress are required" });
    }

    // Drain any pending tips for this creator first so the withdrawal reflects
    // everything tipped so far (nice for the live demo).
    await deps.batcher.flushAll();

    const creator = store.getOrCreateCreator(creatorId);
    if (!isPositiveUsdc(creator.accrued)) {
      return reply.code(409).send({ error: "nothing to withdraw" });
    }

    const amount = creator.accrued;
    const { txRef } = await adapters.circle.withdraw({ creatorId, toAddress, amount });

    // Zero out the accrued balance after a successful payout.
    creator.accrued = subUsdc(creator.accrued, amount);

    const res: WithdrawRes = { txRef };
    return res;
  });
}
