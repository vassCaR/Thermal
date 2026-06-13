# Backend

Node 22 + TypeScript + **Fastify 5**, at `server/`. Mock-first: `MOCK=true`
(default) uses in-memory mock adapters so the whole flow works with zero keys.
Real Unlink/Circle adapters are scaffolded behind ports and activated with
`MOCK=false` + keys.

Run: `npm --prefix server run dev` (http://localhost:8787). Self-test: `npm --prefix server run smoke`.

## Endpoints

| Method | Path | Input | Output | Status |
|--------|------|-------|--------|--------|
| GET | `/health` | — | `{ ok: true }` | OK |
| POST | `/api/onboard` | `{ dynamicAddress }` | `{ fanAccountId }` | OK (mock) · real `registerFan` gated |
| POST | `/api/deposit` | `{ fanAccountId, amount }` | `{ ok, balance }` | OK (mock) |
| POST | `/api/tip` | `TipAuthorization` | `{ accepted, batched }` | OK |
| GET | `/api/me/spent` | `?fanAccountId=` | `{ total }` | OK (mode-independent) |
| GET | `/api/creator/:id/balance` | — | `{ total }` | OK (anonymous) |
| POST | `/api/withdraw` | `{ creatorId, toAddress }` | `{ txRef }` | OK (mock) · real OK for 0x creatorIds only |

HTTP codes: 400 (bad input), 401 (bad signature), 402 (insufficient funds),
404 (unknown fan), 409 (nonce replay / nothing to withdraw). Types come from the
frozen `shared/api.ts`.

## Internals

- `routes.ts` — endpoints + validation. `store.ts` — in-memory fans/creators
  (no fan→creator mapping). `batcher.ts` — per-creator aggregation → settlement,
  re-queues on failure. `verify.ts` — tip signature shape check (mock) / address
  recovery (real hook). `usdc.ts` — BigInt micro-unit math (no floats).
- `ports/` + `adapters/` — `UnlinkAdminPort` + `CircleSettlementPort`, each with a
  Mock and a Real impl. `buildAdapters(cfg)` is the single mock/real switch.
  The Unlink SDK is imported lazily (dynamic import) so mock mode never loads it.

## Mock vs real — what's gated (needs keys + DevRel answers)

1. `RealUnlinkAdmin.registerFan` — needs a client-derived `RegistrationPayloadWire`
   threaded through the port (`@unlink-xyz/sdk/crypto`). `issueAuthToken` is fully wired.
2. `RealCircleSettlement.settleBatch` — exact Gateway REST route/payload to confirm
   with Circle DevRel (real SDK = `@circle-fin/x402-batching`).
3. `withdraw` real path — needs a creator→address registry (`ghost:alice` is not a 0x).
4. `issueAuthToken` exists on the port/mock/real but is **not exposed via an HTTP
   route** yet — the client-side private transfer will need it.
5. `web/lib/tip.ts` is still a mock signer (hex placeholder), not real Dynamic
   signing + Unlink browser transfer.

Keys for real mode: `CIRCLE_API_KEY`, `UNLINK_API_KEY`, `SETTLER_PRIVATE_KEY`,
`MOCK=false`, `UNLINK_ENV=arc-testnet`.

## Code review (this pass)

A dedicated review found the backend above-average for a mock-first MVP: correct
status codes, correct nonce/replay handling, correct BigInt money math, a clean
mock/real seam, disciplined secret/privacy handling.

Fixed this pass:
- **H2** — `parseUsdc` now caps input length (anti CPU-DoS).
- **M3** — `/api/tip` requires integer, non-negative `nonce`/`ts`.
- **H1** — global `setErrorHandler` so real-mode adapter throws return a clean
  error instead of leaking raw 500 bodies.

Deferred (MVP-acceptable, documented for production):
- **M1** rate-limiting on `/api/tip` (per-second endpoint; add `@fastify/rate-limit`).
- **M2** CORS defaults to reflect-all (`*`); lock to an allowlist for non-demo.
- **L1** `withdraw` read-modify-write isn't atomic (safe single-threaded).
- **L3** error responses are off the frozen `*Res` shape (add `ErrorRes`).
- **L2** `server/src/__probe.ts` is a dead scratch file — should be deleted
  (deletion left to the user).
