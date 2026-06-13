# Audit — "Versus" (Arc track winner, HackMoney 2026) vs Ghost Tips

Read-only analysis of the cloned Versus monorepo at `/tmp/versus-ai`, mapped against Ghost
Tips' privacy-first, manual pay-per-second model. Goal: extract what we reuse, what we adapt,
and — most importantly — pinpoint exactly **where Versus leaks the supporter→creator link**
so Ghost Tips can avoid building the same public graph.

All file paths below are from the Versus clone (`/tmp/versus-ai`) unless prefixed with
`ghost-tips/`.

Versus in one line: AI agents (Alice/Bob) auto-generate videos; viewers pay per HLS segment
over Yellow Network state channels to unlock AES keys; each creator has an ERC20 on a sigmoid
bonding curve; revenue settles cross-chain and splits 70/20/10. **Everything — who paid whom,
how much, for which video — is public**, by design (it's the demo's whole point: on-chain
proof for judges).

---

## 1. Pay-per-second logic — where & how

**Mechanism (not literally "per second" — it's per HLS segment).** Video is split by FFmpeg
into AES-encrypted segments; a segment is 5 s by default (`VIDEO_SEGMENT_DURATION=5`,
`apps/server/src/utils/env.ts:69`). To play a segment, the browser must fetch its AES key, and
the key endpoint is paywalled. So the unit of payment is **one segment = 5 s = $0.01**
(`YELLOW_PRICE_PER_SEGMENT="0.01"`, `env.ts:41`; asset `ytest.usd`, `env.ts:40`). Effective
rate ≈ $0.12/min.

**Cadence — driven by the player, not a timer.** `HLS.js` requests the next segment's key as
playback approaches it. Versus installs a custom HLS loader that intercepts key URLs:
- `apps/web/src/components/videos/VideoPlayer.tsx:86-128` — `CosignLoader.load()` matches
  `/key/(\d+)`, extracts `segmentIndex`, and calls `signAndRequestKey(videoId, segmentIndex)`
  instead of doing a plain XHR. On 402 it pauses the video and flags insufficient balance.
- `apps/web/src/hooks/useYellowSession.ts:190-301` — `signAndRequestKey()` builds a NitroLite
  `submit_app_state` message that decrements the viewer allocation by `pricePerSegment` and
  increments the server allocation, signs it with the ephemeral key, and POSTs to `/cosign`.
  A **mutex queue** (`keyQueueRef`, line 74) serializes concurrent key requests so the state
  channel `version` increments by exactly 1, and a `paidSegments` set dedupes seeks.

**Server side** (`apps/server/src/api/routes/streaming.ts`, framework = **Hono**, not Fastify):
- `POST /:videoId/session` (`:36-189`) opens the payment session.
- `GET /:videoId/key/:segment` (`:277-384`) is the paywall: `X-Yellow-Session` header → Yellow
  micropayment via `processSegmentPayment`; else `Authorization: Bearer` → legacy session; else
  **HTTP 402 Payment Required** with instructions.
- `POST /:videoId/cosign` (`:397-472`) is the real path: validates the viewer's signed state,
  co-signs, submits to ClearNode, then returns the raw 16-byte AES key.
- The per-segment accounting lives in `apps/server/src/integrations/yellow/session.ts`:
  `cosignAndSubmitPayment` (`:222-331`) and `processSegmentPayment` (`:337-380`) move
  `pricePerSegment` from `viewerBalance` to `creatorBalance` in an **in-memory `Map`**
  (`activeSessions`, line 69), persisted to Postgres on each tick.

**Key derivation (the actual gate):** keys are derived from a per-video `masterSecret` via HKDF
and committed in a Merkle tree (`packages/streaming/src/crypto/{keys,merkle,aes}.ts`,
`apps/server/src/video/key-handler.ts`). The browser can verify each key against the on-chain
Merkle root (`apps/web/src/lib/merkle-verify.ts`). Payment buys the key; the key decrypts the
segment.

**Ghost Tips contrast:** our tick is **time-based and manual** — a human holds a "Support"
button and the frontend emits ~1 signed authorization/second (`ghost-tips/README.md`, fan
subgraph), batched server-side (`ghost-tips/server/src/batcher.ts`). There is no media, no
keys, no Merkle tree, no HLS. So we reuse the *shape* (signed per-tick authorizations → server
batches → settle on Arc) but not the video machinery.

---

## 2. Yellow Network / state channels — how micropayments are channeled

This is the heart of Versus and the part we **drop entirely**.

- **Off-chain (ClearNode):** `apps/server/src/integrations/yellow/{client,session,settlement}.ts`
  + frontend `apps/web/src/lib/yellow.ts` and `apps/web/src/hooks/useYellowSession.ts`. SDK is
  `@erc7824/nitrolite` (root `package.json`). Flow: browser generates an **ephemeral keypair**,
  authenticates to ClearNode (`wss://clearnet-sandbox.yellow.com/ws`), backend opens an app
  session with `participants: [viewerEphemeral, server]`, `weights: [50,50]`, `quorum: 100`
  (`session.ts:96-104`). Each segment = one co-signed `submit_app_state` that re-allocates
  funds viewer→server; ClearNode enforces allocations never exceed the deposit. On close
  (`closeStreamingSession`, `session.ts:385-489`) the final allocation is submitted and
  settlement triggered.
- **On-chain escrow (Nitrolite Custody on Base Sepolia):**
  `apps/server/src/integrations/nitrolite/channel.ts`. Two-step open: server
  `prepareCustodyChannel` (`:59-103`) → browser co-signs packed state → server
  `openCustodyChannel` via `depositAndCreateChannel` (`:112-160`). Cooperative close +
  `withdrawal` at `:190-260`. This is what makes "deposit once, pay instantly" work.

**Classification: SKIP.** Reasons:
1. Ghost Tips' whole pitch is that **Circle Nanopayments / Gateway on Arc** provide the
   sub-cent, high-frequency, gas-free settlement (`ghost-tips/README.md`, SDK table). Yellow is
   a competing primitive we explicitly don't use.
2. Yellow state channels are **bilateral and identity-bearing**: the channel ties a viewer
   address to the server, and the final allocation is recorded. That's fine for a public
   product, hostile to an anonymous one.
3. We already have the batching seam (`ghost-tips/server/src/batcher.ts` + the
   `CircleSettlementPort` in `ghost-tips/server/src/ports/circle.ts`) playing the role Yellow
   plays here, but routed privately via Unlink.

**One reusable idea (adapt, not the code):** the ephemeral-key + per-tick signed-authorization
pattern (`useYellowSession.ts:240-245`, `signAndRequestKey`) is conceptually close to what we
want for fan tick-authorizations. We can borrow the *pattern* (client signs an off-chain
authorization per tick; server validates monotonic version; mutex-serialize to avoid races) but
implement it over our own `shared/api.ts` contract and Dynamic-signed messages, **not** over
NitroLite RPC.

---

## 3. Creator tokens / sigmoid bonding curve — contracts + math

**Contracts:** `packages/contracts/contracts/` — `CreatorToken.sol` (ERC20, mint/burn gated to
the curve), `BondingCurve.sol`, `CreatorFactory.sol` (deploys a token+curve per creator),
`LendingPool.sol` (agents borrow against holdings). Deployed on ARC Testnet (README contract
table). Hardhat + 20 tests in `packages/contracts/test/`.

**Sigmoid math** (`BondingCurve.sol`):
```
price(supply) = floor + (ceiling - floor) * sigmoid(supply)
sigmoid(x)    = 1 / (1 + e^(-k * (supply - midpoint)))      // _sigmoid, :288-322
floor=0.01 USDC  ceiling=10 USDC  midpoint=10,000  steepness(k)=0.01
```
- Fixed-point via PRBMath (`SD59x18`/`UD60x18`), exponent clamped to `MAX_EXP=133e18` to avoid
  overflow (`:301-310`).
- `buy()` (`:193-210`) takes USDC, mints tokens; `sell()` (`:213-231`) burns, returns USDC from
  reserve. Buy uses a **linear approximation** `tokens = usdcIn * 1e18 / price` (`:331-349`,
  flagged "hackathon MVP"); sell uses average-of-endpoints price (`:357-378`).
- Token-holder revenue uses a **Synthetix-style accumulator**: `addRevenue()` (`:234-247`,
  callable only by the RevenueDistributor) bumps `revenuePerTokenStored`; holders `claimRevenue()`
  (`:250-261`) pro-rata via `earned()` (`:174-177`).

**Classification: SKIP entirely.** Ghost Tips has **no creator tokens, no bonding curve, no
trading, no lending** (confirmed: our README SDK table is Dynamic/Unlink/Arc only; no token
mention; `ghost-tips/docs/audit/` contains only `arc-circle.md`, `backend.md`,
`wallets-dynamic.md`). Beyond being out of scope, a tradable per-creator token is **actively
anti-privacy**: buys/sells, holder lists, and pro-rata revenue claims are all public on-chain
and let an observer infer which creators are earning and from roughly how much volume. Tokens
are a Versus growth/speculation mechanic irrelevant to anonymous support. **Drop.**

---

## 4. Revenue split 70/20/10 — where enforced

Two layers:

1. **Off-chain split (informational/log):** `apps/server/src/integrations/yellow/settlement.ts:63-65`
   computes `creatorShare = totalPaid*0.7`, `tokenHolderShare = *0.2`, `protocolShare = *0.1`
   purely to log and to drive the cross-chain calls.
2. **On-chain enforcement (authoritative):** `packages/contracts/contracts/RevenueDistributor.sol`
   — constants `CREATOR_SHARE=7000`, `HOLDER_SHARE=2000`, `PROTOCOL_SHARE=1000` bps (`:21-27`).
   `distributeRevenue(token, amount)` (`:136-165`, `onlyWhitelisted`) pulls USDC, computes the
   three slices, then: `safeTransfer` to `creatorWallet`, `forceApprove`+`addRevenue()` to the
   `BondingCurve` (holder pool), `safeTransfer` to `treasury`. Emits `RevenueDistributed`.

The trigger chain on session close: `closeStreamingSession` → `triggerSettlement`
(`settlement.ts:42-154`) → `recordSettlementOnChain` (Base Sepolia) → `initiateBridgeOnChain`
(BridgeEscrow, CCTP-style) → `distributeRevenueOnChain` (ARC, calls the contract above),
all in `apps/server/src/integrations/chain/video-registry.ts:99-258`.

**Classification: ADAPT, drastically simplified.** Ghost Tips has no token-holder tier, so 20%
has no recipient, and we likely don't take a 10% protocol cut for an MVP. If we want any split
(e.g., creator vs a protocol fee), it should be a **2-way split applied at withdraw/settlement
inside the Circle adapter** (`ghost-tips/server/src/adapters/circle.real.ts`), **not** a public
on-chain `RevenueDistributor` with per-token mappings — because that contract's
`CreatorRegistered`/`RevenueDistributed` events and `creatorWallets[token]` mapping are a
public ledger of which creator received what. For anonymity, any fee math must happen on the
**aggregated, post-Unlink** amount, never per (fan, creator) pair.

---

## 5. Front/back architecture overview

Monorepo: **pnpm workspaces + Turborepo** (`pnpm-workspace.yaml` → `apps/*`, `packages/*`;
`turbo.json`). Bun lockfile also present. Deploy via `vercel.json` + `railway.toml` + Docker.

- **`apps/server`** — Node backend on **Hono** (not Fastify). `src/api/routes/*` (streaming,
  trading, agents, videos, auth, schedule, health), `src/db` (Drizzle ORM + Postgres,
  migrations incl. `0002_nitrolite_custody.sql`), `src/integrations/*` (yellow, nitrolite,
  circle, chain, stork, ltx, gemini, openrouter, supabase), `src/video/*` (FFmpeg segmenter,
  AES encryptor, HLS packager, Supabase storage), `src/agents/*` (configs, LLM decide/execute
  loop, content scheduler).
- **`apps/web`** — **Next.js (App Router)**. Pages `app/{videos,agents}`; components by domain
  (`videos/`, `trading/`, `dashboard/`, `decisions/`, `wallet/`, `ui/`); hooks
  (`useYellowSession`, `useVideoSession`, `useCircleWallet`, `useTradingChart`, …); `lib/`
  (`api.ts`, `yellow.ts`, `circle.ts`, `merkle-verify.ts`, `config.ts`).
- **`packages/contracts`** — Hardhat Solidity (7 contracts + interfaces + mocks), Ignition
  module `VersusCore.ts`, deploy/seed scripts.
- **`packages/streaming`** — shared crypto/streaming utils (HKDF keys, AES, Merkle, hashing),
  imported by both server and web.

**Vs Ghost Tips** (`ghost-tips/`): also a monorepo but `server/` + `web/` + `shared/api.ts`
(single frozen contract, one-branch-per-dev rule per README). Our backend is **Fastify/TS**,
not Hono. We have **no `packages/contracts`** and **no `packages/streaming`** — the closest
analog to Versus' shared package is our `shared/api.ts`. Their `integrations/circle/*` (Circle
programmable wallets, `executeContractCall`/`waitForConfirmation` in
`apps/server/src/integrations/circle/transactions.ts`) is genuinely useful reference for our
`server/src/adapters/circle.real.ts`, since both call Circle on Arc — though Versus uses
**Developer-Controlled** wallets for *agents*, whereas Ghost Tips uses **Dynamic embedded
wallets** for humans + Circle for settlement.

---

## 6. KEY SECTION — reuse map + the PUBLIC vs ANONYMOUS gap

### 6a. Per-component verdict

| Versus piece | Files | Verdict for Ghost Tips |
|---|---|---|
| Per-segment paywall + 402 gating | `streaming.ts`, `VideoPlayer.tsx:86-128` | **Adapt the pattern** (paywall a resource per tick, return 402 on empty balance) — but our "resource" is a tick of support, not an AES key. No HLS/Merkle. |
| Ephemeral-key per-tick signed authorization + version mutex | `useYellowSession.ts:190-301` | **Adapt the pattern only.** Reuse "sign one monotonic authorization per tick, serialize to avoid version races." Reimplement over `shared/api.ts` + Dynamic, not NitroLite RPC. |
| Yellow ClearNode app sessions | `integrations/yellow/*`, `lib/yellow.ts` | **SKIP.** Replaced by Circle Nanopayments/Gateway batching + Unlink routing. |
| Nitrolite on-chain Custody channels | `integrations/nitrolite/channel.ts` | **SKIP.** We don't escrow in a state channel; Circle settles on Arc. |
| Creator tokens + sigmoid bonding curve + lending | `BondingCurve.sol`, `CreatorToken.sol`, `CreatorFactory.sol`, `LendingPool.sol` | **DROP.** Out of scope and anti-privacy (public buys/sells/holders). |
| `RevenueDistributor` 70/20/10 on-chain | `RevenueDistributor.sol`, `settlement.ts:63-65` | **Adapt → ≤2-way split inside the Circle adapter**, on aggregated amounts. No public per-creator distributor contract. |
| `VideoRegistry` settlement records | `VideoRegistry.sol` | **DROP / invert** — see 6b; this is the clearest privacy leak. |
| Drizzle schema with `viewerAddress`+`creatorAddress` on every session | `apps/server/src/db/schema.ts` | **Adapt → must NOT store the pair.** See 6c. |
| Circle programmable-wallet exec helpers | `integrations/circle/transactions.ts` | **Reusable as reference** for `circle.real.ts` (Arc contract exec, polling, idempotency keys). |
| Monorepo tooling (Turbo/pnpm), Next App Router, Hono routing style | root configs, `apps/*` | **Reference only**; we already chose Fastify + our own layout. |

### 6b. WHERE Versus exposes "who supports whom" on-chain

Versus is public at three on-chain points, all of which Ghost Tips must avoid:

1. **`VideoRegistry.SettlementRecorded`** (`VideoRegistry.sol:29-35`, emitted by
   `recordSettlement` `:55-63`): event carries `viewer` (indexed), `videoIdHash` (indexed,
   maps to a `creator` via the `videos` mapping `:19` set in `registerVideo`), `segmentsWatched`,
   `totalPaid`. **An indexer can join `viewer → videoIdHash → creator` and read the exact amount
   and watch-time. This is the supporter→creator graph, on-chain, public.**
2. **`RevenueDistributor.RevenueDistributed`** (`RevenueDistributor.sol:164`) + `creatorWallets[token]`
   (`:46`, `:112`): public mapping token→creatorWallet, plus per-distribution amounts. Reveals
   which creator earned how much per settlement.
3. **Cross-chain trail:** `recordSettlementOnChain` → `initiateBridgeOnChain` (passes
   `creatorAddress` + `creatorTokenAddress`, `video-registry.ts:151-202`) →
   `distributeRevenueOnChain` (`:210-258`) link a Base Sepolia settlement to an ARC payout to a
   named creator. The whole flow is engineered to be **provable to judges** — i.e. maximally
   transparent.

Off-chain it's just as exposed: `yellow_sessions` (`schema.ts:231-268`) stores
`viewerAddress` **and** `creatorAddress` **and** `creatorBalance` **and** `segmentsDelivered`
in the **same row**, indexed by both `viewer` and `video`. `viewer_sessions` (`:193-209`) and
the in-memory `StreamingSession` (`session.ts:37-65`, with `getSessionByViewer` lookup
`:562-575`) do the same. The supporter→creator→amount tuple is the primary key of their data
model.

### 6c. WHAT Ghost Tips must do differently (concrete, for our stack)

The sensitive asset is the **edge (fan, creator)**, not the amount. Versus stores and emits that
edge everywhere; Ghost Tips must never let it materialize. Concretely:

1. **Never co-locate fan and creator in one record.** In Versus, one `yellow_sessions` row =
   `(viewerAddress, creatorAddress, amount)`. Ghost Tips' tick/authorization records
   (`ghost-tips/server/src/batcher.ts`, and whatever the `shared/api.ts` `/api/tip` payload
   persists) must hold **at most one side**. Keep an ephemeral, in-memory tick buffer keyed by
   an opaque session id; aggregate to a **per-creator anonymous total** only; never write the
   fan identity next to the creem identity. Audit our schema for any column pair analogous to
   `viewerAddress`+`creatorAddress`.

2. **No public per-creator settlement event/contract.** Versus' `VideoRegistry.recordSettlement`
   and `RevenueDistributor.distributeRevenue` are exactly what we must NOT emit. Ghost Tips
   settles via **Circle Nanopayments/Gateway batched** through **Unlink private routing**
   (`ghost-tips/server/src/ports/circle.ts`, `adapters/circle.real.ts`, per
   `docs/audit/arc-circle.md`): the on-chain artifact should prove only "a USDC settlement
   occurred," with parties and per-tip amounts hidden — the inverse of Versus' goal.

3. **Break temporal correlation via the batcher.** Versus settles 1:1 per session close, so each
   payout maps to one viewer's watch. Our `batcher.ts` aggregates **N ticks across many fans**
   into one settlement so an observer can't de-anonymize by timing/amount. This is the privacy
   role Versus simply doesn't have. (Note our own audit `arc-circle.md` flags that the *real*
   `settleBatch` currently throws before submit — privacy depends on that real batched path
   actually shipping, otherwise per-tick `withdraw` transfers would leak just like Versus.)

4. **Creator sees an anonymous accumulated total, withdraws to a Dynamic wallet.** No holder
   list, no token, no pro-rata claim. The creator's balance is an Unlink private-account total
   (`ghost-tips/README.md`, creator subgraph) — there is no `creatorWallets[token]` public
   mapping anywhere.

5. **Reuse the per-tick signing UX, strip the identity.** Borrow `signAndRequestKey`'s
   monotonic-version + mutex-queue discipline (`useYellowSession.ts:74,209,240`) for our
   hold-to-support button so concurrent ticks don't race — but the signed message must be a tip
   authorization against an opaque session, signed by a **Dynamic embedded wallet**, with the
   destination creator resolved server-side and **never echoed back on-chain tied to the fan**.

### 6d. Deliberately dropped, and why

- **Yellow Network / Nitrolite state channels** — replaced by Circle Nanopayments/Gateway on
  Arc; channels are bilateral and identity-bearing, wrong primitive for anonymity, and not in
  our SDK mandate (Dynamic/Unlink/Arc).
- **Creator tokens + sigmoid bonding curve + LendingPool** — out of scope; tradable per-creator
  tokens with public holders/trades/claims are inherently de-anonymizing and a speculation
  mechanic Ghost Tips doesn't want.
- **`VideoRegistry` + public `RevenueDistributor` + CCTP bridge trail** — these exist in Versus
  specifically to make the supporter→creator→amount flow publicly provable; that is the exact
  property Ghost Tips inverts.
- **All video machinery** (FFmpeg segmenter, AES/HKDF/Merkle, HLS packaging, Supabase, LTX/Gemini
  generation, the AI agent loop) — Ghost Tips is manual (human holds a button), no media, no AI
  agent.

---

## TL;DR for the team

Reuse from Versus: the **mental model** of per-tick signed authorizations gated by balance with
402 backpressure, the **mutex/monotonic-version** discipline for concurrent ticks, and Circle-
on-Arc contract-call plumbing as reference. Drop: Yellow/Nitrolite, tokens/bonding curve,
LendingPool, and every video/AI subsystem. The single most important divergence: Versus' data
model and on-chain events are **built around the (viewer, creator, amount) tuple** (
`VideoRegistry.SettlementRecorded`, `RevenueDistributor`, the `yellow_sessions` row). Ghost
Tips must guarantee that tuple **never co-exists** — fan-side and creator-side stay split,
settlement is batched across fans and routed through Unlink, and the only public fact is "a USDC
settlement happened on Arc," with no recoverable support graph.
