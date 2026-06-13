# Ghost Tips — Backend (`/server`)

Private USDC nanopayments backend for **Ghost Tips** (ETHGlobal New York 2026,
track *Best Private Nano Payment App* — Dynamic + Unlink + Arc/Circle).

A fan supports a creator with per-second USDC tips. **Nobody can see who supports
whom**, the amounts, or the balances. The creator sees only an anonymous accruing
total they can withdraw.

This server is **self-contained** (its own `package.json` / `tsconfig.json`) and
implements the frozen API contract in [`../shared/api.ts`](../shared/api.ts) — the
single source of truth shared with `/web`. We never redefine those types here
(see `src/contract.ts`, a one-line re-export).

---

## Run it

```bash
cd server
cp .env.example .env     # optional — with MOCK=true (default) you need no keys
npm install
npm run dev              # tsx watch, http://localhost:8787
```

Other scripts:

```bash
npm run build            # tsc -> dist/   (emits dist/server/src + dist/shared)
npm start                # node dist/server/src/index.js
npm run typecheck        # tsc --noEmit
npm run smoke            # in-process end-to-end smoke test (no port needed)
```

> **Why `start` runs `dist/server/src/index.js`:** the shared contract lives
> outside `/server` (`/shared/api.ts`). To compile the cross-root import without
> copying the file, `tsconfig.json` sets `rootDir: ".."`, so `tsc` emits
> `dist/server/...` next to `dist/shared/...` and the relative import resolves at
> runtime. Dev mode (`tsx`) runs the `.ts` directly with no build step.

### Quick curl check

```bash
curl localhost:8787/health
# {"ok":true}

FAN=$(curl -s localhost:8787/api/onboard -H 'content-type: application/json' \
  -d '{"dynamicAddress":"0xFan...01"}' | sed 's/.*"fanAccountId":"//;s/".*//')

curl -s localhost:8787/api/deposit -H 'content-type: application/json' \
  -d "{\"fanAccountId\":\"$FAN\",\"amount\":\"1.000000\"}"
# {"ok":true,"balance":"1.000000"}

curl -s localhost:8787/api/tip -H 'content-type: application/json' \
  -d "{\"fanAccountId\":\"$FAN\",\"creatorId\":\"ghost:alice\",\"amount\":\"0.002000\",\"nonce\":1,\"ts\":$(date +%s000),\"signature\":\"0xaaaa\"}"
# {"accepted":true,"batched":1}

curl -s "localhost:8787/api/me/spent?fanAccountId=$FAN"          # {"total":"0.002000"}
curl -s localhost:8787/api/creator/ghost:alice/balance          # {"total":"..."} after a batch window
curl -s localhost:8787/api/withdraw -H 'content-type: application/json' \
  -d '{"creatorId":"ghost:alice","toAddress":"0xCreator...02"}' # {"txRef":"0x..."}
```

---

## Endpoints (exactly per `shared/api.ts`)

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET  | `/health` | — | `{ ok: true }` |
| POST | `/api/onboard` | `{ dynamicAddress }` | `{ fanAccountId }` |
| POST | `/api/deposit` | `{ fanAccountId, amount }` | `{ ok, balance }` |
| POST | `/api/tip` | `TipAuthorization` | `{ accepted, batched }` |
| GET  | `/api/me/spent` | `?fanAccountId=` | `{ total }` |
| GET  | `/api/creator/:creatorId/balance` | — | `{ total }` (anonymous) |
| POST | `/api/withdraw` | `{ creatorId, toAddress }` | `{ txRef }` |

Behavior notes:
- **`/api/tip`** verifies the nonce is **strictly monotonic per fan** (anti-replay
  → `409`), checks the signature (presence/shape in mock — see below), checks the
  fan has funds (`402` if not), debits the fan's private balance, bumps their
  spend, and pushes the tick into the **per-creator batch**. `batched` is the
  current pending count for that creator.
- **`/api/creator/:id/balance`** returns only the anonymous accrued total. There
  is **no endpoint and no data structure** that lists a creator's supporters.
- **`/api/withdraw`** flushes pending tips first, then pays out the full accrued
  total and zeroes it.

USDC amounts are always 6-decimal strings (e.g. `"0.002000"`). All arithmetic is
done in `BigInt` micro-units (`src/usdc.ts`) — never floats.

---

## Mock vs Real toggle

Everything external sits behind two typed **ports**. One env var flips both:

```
MOCK=true    # default — MockUnlinkAdmin + MockCircleSettlement (in-memory, no keys)
MOCK=false   # RealUnlinkAdmin + RealCircleSettlement (require keys; see below)
```

`src/adapters/index.ts` is the **only** place that chooses mock vs real. When
`MOCK=false`, `assertRealConfig()` fails fast if any required key is missing.

The mock adapters return realistic, opaque values (generated account ids,
short-lived tokens, `0x…`-shaped tx hashes) so `/web` can integrate the full flow
**today**, with zero keys.

---

## Adapter architecture (the seams)

```
src/
  contract.ts            re-export of ../../shared/api.ts (single source of truth)
  config.ts              env parsing + assertRealConfig (fail fast in real mode)
  env.ts                 dependency-free .env loader
  usdc.ts                BigInt-based USDC string math (6 decimals)
  store.ts               in-memory state (fans: balance/spent/nonce; creators: accrued)
  verify.ts              tip signature verification (presence in mock; recover in real)
  batcher.ts             per-creator aggregation -> CircleSettlementPort.settleBatch
  routes.ts              all endpoints, exactly per the contract
  app.ts                 Fastify builder: config -> adapters -> store -> batcher -> routes
  index.ts               bootstrap (listen + graceful shutdown drains the batcher)
  ports/
    unlink.ts            UnlinkAdminPort  (registerFan, issueAuthToken)
    circle.ts            CircleSettlementPort (settleBatch, withdraw)
  adapters/
    unlink.mock.ts       default
    unlink.real.ts       TODO wrapper — real Unlink admin SDK
    circle.mock.ts       default
    circle.real.ts       TODO wrapper — real Circle Nanopayments on Arc
    index.ts             buildAdapters(cfg): the mock/real switch
scripts/
  smoke.ts               in-process end-to-end test (npm run smoke)
```

**Server's role (admin side only).** The *private per-second transfer* is done
**client-side** by `/web` (`@unlink-xyz/sdk/browser` + the fan's Dynamic
provider). The server uses the **admin** surface: register fan accounts, issue
authorization tokens, and settle batches on Arc via Circle.

### Batcher

`BATCH_INTERVAL_MS` (default 4000) controls a single timer that flushes **every
creator with pending ticks**: it sums them, calls `CircleSettlementPort.settleBatch`
once per creator, and credits the creator's anonymous accrued total. On settle
failure the batch is re-queued. Graceful shutdown does a final drain.

> **TODO (scale):** today we settle one creator-batch per window (the "simplest
> path first" the brief asked for). To use full Circle Nanopayments batching,
> aggregate across creators / rolling windows into one multi-recipient Gateway
> settlement. Marked in `src/batcher.ts` and `src/adapters/circle.real.ts`.

---

## What stays private (and what doesn't)

This is the heart of the prize.

**Private (hidden):**
- **The fan → creator link** (who supports whom). Transfers route through Unlink's
  shielded pool, so the fan's source account is not linkable to the creator
  on-chain. The server stores **no** fan→creator mapping (`src/store.ts`).
- **Per-tip amounts and balances** of both fan and creator — confidential inside
  the Unlink private accounts.
- **Timing/frequency** of tips — the batcher + Circle's batched settlement
  aggregate N ticks into one settlement, breaking the per-tick timing correlation.

**Public / verifiable (by design):**
- **Deposits into and withdrawals out of** the Unlink shielded pool are visible
  on-chain. Entering/exiting the pool is observable; *who-pays-whom inside it is
  not*.
- That a USDC settlement happened on Arc (integrity) — but **not** the individual
  parties or amounts. On an Arc explorer you **cannot** reconstruct the support
  graph.

---

## Keys / env to go live (`MOCK=false`)

| Var | Purpose | Where to get it |
|---|---|---|
| `UNLINK_API_KEY` | Unlink admin/API auth | Unlink dashboard / DevRel |
| `UNLINK_ENV` | Unlink environment string for Arc | **Confirm exact value with Unlink DevRel** |
| `UNLINK_ENGINE_URL` | Unlink engine/API base URL | Unlink docs/DevRel |
| `CIRCLE_API_KEY` | Circle Developer (Nanopayments/Gateway) | Circle Developer console |
| `CIRCLE_GATEWAY_URL` | Circle Gateway base URL for Arc testnet | Circle docs/DevRel |
| `USDC_ADDRESS` | USDC testnet contract on Arc | Circle / Arc docs |
| `ARC_RPC_URL` | Arc testnet JSON-RPC | Arc / Circle docs |
| `SETTLER_PRIVATE_KEY` | `0x` key of the relayer that settles on Arc | you generate; fund on testnet |
| `CHAIN_ENV` | logical tag forwarded to adapters | defaults to `arc-testnet` |

`PORT` (8787), `HOST`, `BATCH_INTERVAL_MS` (4000), `CORS_ORIGINS` (`*`),
`LOG_LEVEL` are operational and have safe defaults.

### What remains to wire (when keys arrive)

1. **`src/adapters/unlink.real.ts`** — implement `registerFan` + `issueAuthToken`.
   The published `@unlink-xyz/sdk` canary exposes `createUnlink` /
   `createUnlinkClient` / `createUser` / `getUser`, **not** the documented
   `createUnlinkAdmin` / `authorizationTokens.issue`. Pick Option A (admin SDK) or
   Option B (low-level client) once DevRel confirms — both sketched in the file.
2. **`src/adapters/circle.real.ts`** — implement `settleBatch` + `withdraw` against
   Circle Gateway on Arc (sign with `SETTLER_PRIVATE_KEY` via viem, submit batched
   authorizations). `@circle-fin/nanopayments` is not on public npm yet (gated).
3. Flip `MOCK=false`, fill `.env`, restart. No other code changes needed.

---

## Open questions for DevRel (to unblock real integration)

**Unlink**
1. Does Unlink support **Arc** today, and what is the **exact `environment`
   string** (`UNLINK_ENV`) and **engine URL** (`UNLINK_ENGINE_URL`) for Arc testnet?
2. Which package/version exposes the **admin** API the docs describe
   (`createUnlinkAdmin`, `admin.users.register()`, `admin.authorizationTokens.issue()`)?
   The public `@unlink-xyz/sdk@0.0.2-canary.0` only exports the low-level
   `createUnlinkClient` / `createUser` path — should the server use that instead?
3. For per-second tips, is there a **server-issued authorization token** the
   browser SDK consumes, or should the fan's client sign every private transfer
   directly (server only registers accounts)?

**Circle**
1. What is the exact **Circle Nanopayments / Gateway endpoint and request shape**
   for **Arc testnet** (`CIRCLE_GATEWAY_URL` + payload), and the **USDC testnet
   address** on Arc?
2. Can a single batched settlement be **multi-recipient** (many creators in one
   Gateway call), or is it one settlement per recipient? (Drives the batcher scale
   TODO.)
3. What does the **settler key** need on Arc testnet (gas/USDC funding, allowance/
   Permit2 to the Gateway), and what reference/`txRef` does Gateway return that we
   can surface to the creator?
```
