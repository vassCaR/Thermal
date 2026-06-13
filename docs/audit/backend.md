# Ghost Tips — Backend Audit

Read-only audit of the Node/TypeScript + Fastify ^5 backend. Mock-first, ports/adapters.
Scope: `server/src/*`, `shared/api.ts`, `server/package.json`, `server/scripts/smoke.ts`.

**TL;DR:** The backend already implements the manual hold-to-support money-shot end-to-end in
MOCK mode. The current `/api/tip` endpoint *is* the per-second mechanism: each held second the
client POSTs one `TipAuthorization` (incrementing `nonce`), the server debits the fan's private
balance, accumulates the tick into a per-creator batch, settles the batch on a timer via the
Circle adapter, and credits an **anonymous** creator total that `/api/creator/:id/balance`
exposes with zero fan identities. No real keys required. The gaps are real-mode only (gated
adapters) plus some naming/ergonomics for the demo. See sections 4 and 5.

---

## 1. Endpoints

All paths and request/response shapes come from the FROZEN contract `shared/api.ts`
(re-exported via `server/src/contract.ts:10`). Routes are registered in
`server/src/routes.ts`. Validation helper `badUsdc()` is at `routes.ts:46`.

### `GET /health` — `routes.ts:59`
- **Out:** `{ ok: true }`.
- **Status:** DONE. Trivial liveness probe.

### `POST /api/onboard` — `routes.ts:62`
- **In:** `OnboardReq { dynamicAddress: string }` (`shared/api.ts:54`).
- **Out:** `OnboardRes { fanAccountId }` (`shared/api.ts:57`).
- **Behaviour:** validates `dynamicAddress` is a non-empty string (`routes.ts:64`), calls
  `adapters.unlink.registerFan({ dynamicAddress })` (`routes.ts:67`), then `store.createFan()`
  (`routes.ts:68`) seeds an in-memory fan with balance/spent = 0 and `lastNonce = 0`
  (`store.ts:34`).
- **Status:** **DONE (mock)** / **GATED (real)**. In mock the adapter returns an opaque
  `ghostfan_<uuid>` unrelated to the address (`unlink.mock.ts:22`). In real the adapter
  **throws on purpose** — `admin.users.register()` needs a client-derived `RegistrationPayload`
  (spending/viewing/nullifying keys) that a bare public `dynamicAddress` cannot produce
  (`unlink.real.ts:130-145`). The smoke test asserts the returned id does NOT leak the address
  (`smoke.ts:54`).

### `POST /api/deposit` — `routes.ts:74`
- **In:** `DepositReq { fanAccountId, amount }` (`shared/api.ts:61`).
- **Out:** `DepositRes { ok, balance }` (`shared/api.ts:65`).
- **Behaviour:** validates `fanAccountId` is a string and `amount` is well-formed USDC and `> 0`
  (`routes.ts:76-83`); 404 if fan unknown (`routes.ts:85`); credits the in-memory balance with
  `addUsdc` (`routes.ts:89`).
- **Status:** **DONE (mock)** / **NOT IMPLEMENTED on-chain (real)**. Comment at `routes.ts:87`
  is explicit: real Unlink deposits into the shielded pool are PUBLIC on-chain and that step is
  client-side; here it just credits memory. There is no on-chain deposit code in either adapter.

### `POST /api/tip` — `routes.ts:95`  ← the per-second / hold-to-support mechanism
- **In:** `TipAuthorization { fanAccountId, creatorId, amount, nonce, ts, signature }`
  (`shared/api.ts:27`).
- **Out:** `TipRes { accepted, batched }` (`shared/api.ts:70`). `batched` = current pending tick
  count for that creator.
- **Behaviour (all real logic, runs in mock):**
  1. Shape validation of the authorization (`routes.ts:97-106`); amount must be valid USDC `> 0`
     (`routes.ts:107-111`).
  2. 404 if fan unknown (`routes.ts:114`).
  3. **Anti-replay:** `nonce` must be strictly `> fan.lastNonce`, else 409 (`routes.ts:117`).
  4. **Signature check:** `verifyPresence(auth)` — presence/shape only in mock; full
     `recoverMessageAddress` path exists but is unused (`verify.ts:24` and `verify.ts:39`). 401
     on failure (`routes.ts:124`).
  5. **Funds check** against the fan's own private balance; 402 if insufficient, returning the
     current `batched` count (`routes.ts:128-131`).
  6. **Commit:** debit balance, bump `spent`, set `lastNonce`, then `batcher.add({ creatorId,
     amount, nonce, ts })` — **`fanAccountId` is intentionally NOT forwarded** (`routes.ts:134-144`).
- **Status:** **DONE (mock, this is the core loop)**. Settlement of the accumulated batch is via
  the Circle adapter (mock or gated-real). The privacy property (no fan id past the batcher) is
  enforced here and again in the port type (`ports/circle.ts:21` — `SettlementItem` has no
  `fanAccountId`).

### `GET /api/me/spent?fanAccountId=...` — `routes.ts:151`
- **In:** `fanAccountId` query param.
- **Out:** `SpentRes { total }` (`shared/api.ts:75`) — the fan's own lifetime spend.
- **Behaviour:** 400 if missing param (`routes.ts:155`), 404 if fan unknown (`routes.ts:159`),
  returns `fan.spent` (`routes.ts:160`).
- **Status:** **DONE (mock)**. Fan-private view; works the same in real (reads in-memory state).

### `GET /api/creator/:creatorId/balance` — `routes.ts:166`  ← the anonymous creator total
- **Out:** `CreatorBalanceRes { total }` (`shared/api.ts:79`) — "total accumulé, ANONYME (aucune
  liste de fans)".
- **Behaviour:** `store.getOrCreateCreator(creatorId)` so a new creator shows `0.000000` with no
  404 churn (`routes.ts:172`); returns `creator.accrued` (`routes.ts:173`).
- **Status:** **DONE (mock)**. The creator record holds only `{ creatorId, accrued, settlements }`
  — there is deliberately no fan→creator table anywhere (`store.ts:22-28`, privacy note
  `store.ts:1-8`). `accrued` is incremented only by the batcher after settlement
  (`batcher.ts:100`). This IS the anonymous total the demo needs.

### `POST /api/withdraw` — `routes.ts:179`
- **In:** `WithdrawReq { creatorId, toAddress }` (`shared/api.ts:83`).
- **Out:** `WithdrawRes { txRef }` (`shared/api.ts:87`).
- **Behaviour:** validates both strings (`routes.ts:181`); **flushes all pending batches first**
  so the payout reflects everything tipped so far (`routes.ts:187`, nice for the live demo); 409
  if `accrued` is not positive (`routes.ts:190`); calls `adapters.circle.withdraw(...)`
  (`routes.ts:195`); zeroes `accrued` after success (`routes.ts:198`).
- **Status:** **DONE (mock)** / **PARTIALLY REAL**. Mock returns a fake `0x…64hex` txRef
  (`circle.mock.ts:34`). Real withdraw is an actual on-chain ERC-20 USDC transfer via viem and
  is described as already working same-chain on Arc (`circle.real.ts:223-248`).

---

## 2. Adapters (ports & adapters)

Factory `buildAdapters(cfg)` is the single mock-vs-real switch (`adapters/index.ts:20`); nothing
else imports a concrete adapter. Each port carries a `readonly kind: "mock" | "real"` discriminator.

### UnlinkAdminPort — `ports/unlink.ts`
Two methods: `registerFan` and `issueAuthToken` (`ports/unlink.ts:40-46`). Models the ADMIN side
only; the actual private per-second transfer is client-side (`@unlink-xyz/sdk/browser` + Dynamic)
per the header comment (`ports/unlink.ts:1-17`).

| Method | Mock (`unlink.mock.ts`) | Real (`unlink.real.ts`) |
|---|---|---|
| `registerFan` | Returns opaque `ghostfan_<uuid>`, no network, no link stored (`unlink.mock.ts:19-24`). | **GATED — throws.** Admin client is fully constructed (dynamic import in `getAdmin()`, `unlink.real.ts:85-101`; Arc env `arc-testnet` confirmed `:37-41`), but `admin.users.register()` needs a client-derived `RegistrationPayload`; `RegisterFanInput` only has `dynamicAddress`, so it throws with a precise TODO to thread the wire payload through the port (`unlink.real.ts:130-145`). |
| `issueAuthToken` | Returns `utok_<hex>` with `expiresAt` = now + 5 min (`unlink.mock.ts:26-32`). | **REAL & wired.** Calls `admin.authorizationTokens.issue({ subjectType:"unlink_address", unlinkAddress })`; `creatorId` deliberately not forwarded (privacy); returns `{ token, expiresAt: ms }` (`unlink.real.ts:157-172`). |

**Note:** `issueAuthToken` is implemented in both adapters and on the port, **but is not wired to
any HTTP route** (no endpoint calls it; confirmed by grep across `routes.ts`/`shared/api.ts`). For
the manual demo this is fine (no real private transfer happens), but the real per-second client
flow would need an endpoint to mint this token.

### CircleSettlementPort — `ports/circle.ts`
Two methods: `settleBatch` (aggregate one per-creator window) and `withdraw` (pay out accrued)
(`ports/circle.ts:53-59`). `SettlementItem` purposely has NO `fanAccountId` (`ports/circle.ts:21`).

| Method | Mock (`circle.mock.ts`) | Real (`circle.real.ts`) |
|---|---|---|
| `settleBatch` | 25 ms simulated latency, fake `0x…64hex` txRef, echoes total + item count, no identities (`circle.mock.ts:24-32`). | **GATED — throws at the submit step.** Steps 1–2 are real: re-derives the atomic total from items and asserts it matches the batcher's pre-sum (`circle.real.ts:174-185`); resolves the creator payout address (`:189`). Step 3 `submitGatewaySettlement()` **intentionally throws** because the exact Gateway batch-settlement REST route/payload is unconfirmed (the reference only drives it via the `@circle-fin/x402-batching` SDK, which is not a dependency) (`circle.real.ts:303-357`). The intended fetch is written out but commented/gated. |
| `withdraw` | 25 ms latency, fake txRef (`circle.mock.ts:34-37`). | **REAL.** Validates `toAddress`/amount, does an on-chain `erc20.transfer` on Arc via viem, waits for the receipt, returns the tx hash as `txRef` (`circle.real.ts:223-248`). |

Real-mode extras: a real `resolveCreatorPayoutAddress()` currently only accepts a `creatorId` that
*is itself* a `0x` address and otherwise throws with a TODO to wire a creator→address registry
(`circle.real.ts:269-276`); and a non-port `gatewayBalance()` helper that hits the CONFIRMED public
balances REST endpoint for the settler's own address (`circle.real.ts:365-387`). A GO-LIVE checklist
is at `circle.real.ts:390-412`. Note: `RealCircleSettlement`'s constructor builds viem clients and
validates env eagerly (`circle.real.ts:104-144`), but it's only constructed when `MOCK=false`
(`adapters/index.ts:27`), so mock mode never touches viem/Arc.

### Config gating — `config.ts`
`MOCK` defaults to `true` (`config.ts:54`). `assertRealConfig()` fails fast if `MOCK=false` and any
of `UNLINK_API_KEY`, `UNLINK_ENGINE_URL`, `CIRCLE_API_KEY`, `CIRCLE_GATEWAY_URL`, `USDC_ADDRESS`,
`SETTLER_PRIVATE_KEY`, `ARC_RPC_URL` is missing (`config.ts:76-92`, called from `app.ts:22`). So the
project runs with zero keys today and refuses to half-boot into real mode.

---

## 3. DONE / MOCKED / TO BUILD

| Area | Status | Notes / file:line |
|---|---|---|
| `GET /health` | **DONE** | `routes.ts:59` |
| `POST /api/onboard` | **MOCKED** (real gated) | mock `unlink.mock.ts:19`; real throws `unlink.real.ts:139` |
| `POST /api/deposit` | **MOCKED** (in-memory only) | credits memory `routes.ts:89`; on-chain deposit not implemented anywhere |
| `POST /api/tip` (per-second core) | **DONE (mock)** | full validate→nonce→sig→funds→debit→batch `routes.ts:95-148` |
| `GET /api/me/spent` | **DONE (mock)** | `routes.ts:151` |
| `GET /api/creator/:id/balance` (anon total) | **DONE (mock)** | `routes.ts:166`; no fan link `store.ts:22-28` |
| `POST /api/withdraw` | **DONE (mock)**; real partially | mock `circle.mock.ts:34`; real transfer `circle.real.ts:223` |
| Per-creator batcher / aggregation | **DONE** | `batcher.ts` (timer flush `:58-65`, settle+credit `:94-114`) |
| USDC BigInt math (6-dp strings, no floats) | **DONE** | `usdc.ts` (parse `:15`, format `:33`) |
| In-memory store, no fan→creator mapping | **DONE** | `store.ts` (privacy note `:1-8`) |
| Signature presence check | **DONE (mock)** | `verify.ts:24` |
| Full signature recovery (`verifyAgainstAddress`) | **TO BUILD / unused** | implemented `verify.ts:39` but never called; needs signer address out-of-band |
| `issueAuthToken` HTTP endpoint | **TO BUILD** | adapter method exists (`unlink.real.ts:157`) but no route wires it |
| Unlink `registerFan` (real) | **TO BUILD (gated)** | needs client-derived `RegistrationPayloadWire` through the port `unlink.real.ts:131-138` |
| Circle `settleBatch` (real) | **TO BUILD (gated)** | confirm Gateway settle route/SDK `circle.real.ts:349-356` |
| Real on-chain deposit into shielded pool | **TO BUILD** | client-side per design; no server code |
| Creator→payout-address registry (real withdraw/settle) | **TO BUILD** | `circle.real.ts:269-276` |
| Cross-creator / rolling-window Nanopayments batching | **TO BUILD (scale)** | TODO `batcher.ts:12-15` |
| Env loader, CORS, error handler, graceful shutdown | **DONE** | `env.ts`, `app.ts:35-62`, `index.ts:24-31` |
| Smoke test (full flow, mock) | **DONE** | `scripts/smoke.ts` (`npm run smoke`) |

---

## 4. Is the backend sufficient for the MANUAL hold-to-support money-shot?

**Yes — for the manual MOCK demo, the backend is already sufficient end-to-end.** The smoke test
(`scripts/smoke.ts`) literally exercises this flow and passes: onboard → deposit `1.000000` → three
`/api/tip` ticks of `0.002000` (nonces 1–3, `batched` grows 1→2→3) → `me/spent == 0.006000` → wait
for the batch window → `creator/:id/balance == 0.006000` → withdraw zeroes it
(`smoke.ts:72-128`).

How each piece of the money-shot maps:

- **Start / hold / stop a per-second support.** This is purely a client concern. The server has no
  notion of a "session" or start/stop — it just accepts one authorization per call. The intended
  pattern (confirmed by `shared/api.ts:24` "signée ~1x/seconde" and the loop in `smoke.ts:73`) is:
  while the button is held, the client emits one `TipAuthorization` per second with `nonce++`. Stop
  = client stops emitting. **This cleanly supports hold-to-support** with no server change.
- **Accumulate an amount.** Each accepted tick debits the fan (`routes.ts:134`) and is pushed into
  the per-creator pending batch (`routes.ts:139`, `batcher.ts:46`). A timer (`BATCH_INTERVAL_MS`,
  default 4000 ms — `config.ts:59`) flushes and sums them, then credits `creator.accrued`
  (`batcher.ts:94-101`). Accumulation is correct and uses exact BigInt micro-USDC.
- **Expose an ANONYMOUS total to the creator.** `GET /api/creator/:id/balance` returns
  `creator.accrued` only (`routes.ts:173`). There is no fan list, no fan→creator mapping anywhere
  (`store.ts:22-28`), and `fanAccountId` is never forwarded into settlement (`routes.ts:138`,
  `ports/circle.ts:21`). **This is exactly the anonymous total the demo needs.**
- **Settle via the Circle adapter mock.** The batcher calls `circle.settleBatch(...)` and the mock
  returns a realistic anonymous txRef with a small latency (`batcher.ts:98`, `circle.mock.ts:24`).
  Withdraw also routes through the mock (`circle.mock.ts:34`).

### What is missing / should be added or renamed for this flow

Nothing blocks the manual mock demo. The following are polish/ergonomics, in rough priority:

1. **Naming (cosmetic but on-brand).** The product is "hold-to-support" but the API says "tip"
   everywhere (`/api/tip`, `TipAuthorization`, `TipRes`, `tipMessageToSign`). The contract is
   marked FROZEN (`shared/api.ts:1-8`) and shared with the web dev, so **do not rename mid-demo.**
   If a rename is wanted, do it once with the web dev (e.g. `/api/support`, `SupportAuthorization`,
   `held`/`supported` fields) and update `shared/api.ts` + `routes.ts` + `smoke.ts` together. The
   current "tip" endpoint already IS the per-second mechanism; renaming is optional.
2. **`batched` vs a money figure.** `TipRes.batched` is a *count* of pending ticks, not an amount
   (`batcher.ts:54`). For a live "counter going up" money-shot the creator screen should poll
   `/api/creator/:id/balance` for the dollar total; the fan screen can show `/api/me/spent`. That
   already works — just be aware `batched` is a count, not money.
3. **Settlement latency in the demo.** Default `BATCH_INTERVAL_MS = 4000` (`config.ts:59`) means the
   creator's anonymous total lags up to ~4 s behind live tipping. The smoke test lowers it to 300 ms
   (`smoke.ts:20`). For a snappier on-stage demo, set `BATCH_INTERVAL_MS` low (e.g. 1000) or rely on
   the withdraw-time `flushAll()` (`routes.ts:187`). No code change needed.
4. **No per-creator live "rate" / supporter count.** If the money-shot wants "N people supporting
   now" or "$/sec", that is not tracked (and a live supporter count would be a privacy risk). The
   anonymous cumulative total is the privacy-safe figure to show.
5. **`issueAuthToken` is unrouted.** Irrelevant to the manual mock demo (no real private transfer),
   but if the real client flow is ever wired, add an endpoint that calls
   `adapters.unlink.issueAuthToken(...)` (method ready at `unlink.mock.ts:26` / `unlink.real.ts:157`).

---

## 5. What remains for a minimal MVP (mock-first, no real keys)

For a *mock* MVP demonstrating the full money-shot: **essentially nothing — it already runs.**
`npm run dev` (or `npm run smoke`) boots in MOCK mode with zero keys (`config.ts:54`,
`package.json:11,15`). Optional nice-to-haves, none blocking:

- **Lower `BATCH_INTERVAL_MS`** for a livelier counter during the demo (env only).
- **(Optional) rename tip→support** in the frozen contract — coordinate once with the web dev.
- **(Optional) route `issueAuthToken`** if the real Unlink client integration is on the roadmap.
- **(Optional) wire `verifyAgainstAddress`** (`verify.ts:39`) if you want real EIP-191 signature
  enforcement in mock — requires capturing the signer address at onboard and threading it to the
  tip handler.

For a *real* MVP (out of "no keys" scope, listed for completeness — all gated, all flagged in code):

1. Provide the 7 real env vars; `assertRealConfig` enforces them (`config.ts:76-92`).
2. **Unlink `registerFan`:** thread the client-derived `RegistrationPayloadWire` through
   `UnlinkAdminPort.registerFan` and call `admin.users.register(wire)` (`unlink.real.ts:131-138`).
   Add an endpoint for `issueAuthToken` so the client can perform the private transfer.
3. **Circle `settleBatch`:** confirm the Gateway batch-settlement route/SDK and enable
   `submitGatewaySettlement` (`circle.real.ts:349-356`); wire a creator→payout-address registry
   (`circle.real.ts:269-276`).
4. **On-chain deposit** into the shielded pool (client-side per the design).
5. Persist state (currently in-memory, resets on restart — `store.ts:1`) if real money is at stake.

---

### Privacy posture (worth keeping in the demo narrative)
The fan→creator link exists **nowhere** server-side: not in the store (`store.ts:22-28`), not in the
settlement item type (`ports/circle.ts:21`), not forwarded by the tip handler (`routes.ts:138`), and
not encoded in the issued auth token (`unlink.real.ts:153-155`). Aggregating N ticks into one
per-creator settlement (`batcher.ts:5-8`) also breaks the timing correlation between an individual
support tick and any on-chain event. This is the core of the "Best Private Nano Payment App" pitch.
