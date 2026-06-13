# Audit — Arc integration via the Circle settlement adapter

Scope: read-only audit of the Ghost Tips settlement seam onto **Arc** (Circle's L1, USDC)
through the `CircleSettlementPort`. Target chain is Arc via the Circle Gateway /
Nanopayments ("x402-batching") adapter.

Files audited:
- `server/src/ports/circle.ts`
- `server/src/adapters/circle.mock.ts`
- `server/src/adapters/circle.real.ts`
- `server/src/adapters/index.ts`
- `server/src/config.ts`
- `server/src/batcher.ts`
- `server/.env.example` (note: `server/src/.env.example` does **not** exist — the only env template is `server/.env.example`)

Supporting files read to verify the seam end-to-end: `server/src/usdc.ts`,
`server/src/contract.ts`, `shared/api.ts`, `server/src/routes.ts`, `server/src/app.ts`,
and `server/node_modules/viem/_esm/chains/definitions/arcTestnet.js`.

---

## 1. State of the Arc integration (per method)

The adapter is selected in exactly one place — `buildAdapters()` in
`server/src/adapters/index.ts:20-31` — keyed off `cfg.mock` (`MOCK` env, default
**true**, `config.ts:54`). Default runtime is therefore MOCK.

| Method | Mock (`MOCK=true`, default) | Real (`MOCK=false`) | Verdict |
|---|---|---|---|
| `settleBatch` | Implemented, returns fake txRef (`circle.mock.ts:24-32`) | Coded but **gated/throwing** — on-chain submit step throws (`circle.real.ts:165-205` → `submitGatewaySettlement` `:349-356`) | **REAL = ABSENT in practice** (constructs request, then throws before any network call) |
| `withdraw` | Implemented, returns fake txRef (`circle.mock.ts:34-37`) | Implemented as a **real** on-chain ERC-20 USDC `transfer` via viem (`circle.real.ts:223-248`) | **REAL = present** (genuinely executes given funded key + valid `toAddress`) |

Summary:
- **settleBatch:** MOCK works; the REAL path is **wired but deliberately non-functional**
  (throws by design rather than emitting an unverified Gateway payload).
- **withdraw:** MOCK works; the REAL path is a **functional same-chain USDC transfer** on Arc.

So the only thing that actually moves value on Arc today in real mode is `withdraw`
(a plain ERC-20 transfer). The core batched-settlement to Circle Gateway is not live.

---

## 2. What actually flows today (MOCK mode)

Path of a tip → settlement in the default (mock) configuration:

1. **Ingest (`routes.ts:95-148`).** `POST /api/tip` validates a `TipAuthorization`
   (`fanAccountId`, `creatorId`, `amount`, `nonce`, `ts`, `signature`), checks
   monotonic nonce, signature presence, and the fan's private balance. On commit it
   debits the fan's balance/spend (`routes.ts:134-136`) and pushes a settlement item.
2. **Privacy strip at the boundary (`routes.ts:138-144`).** The `batcher.add({...})`
   call forwards **only** `creatorId`, `amount`, `nonce`, `ts` — `fanAccountId` is
   explicitly **not** forwarded (inline comment, `routes.ts:138`). This matches
   `SettlementItem` in `ports/circle.ts:21-26`, which has no fan field.
3. **Aggregation (`batcher.ts`).** Items accumulate in a `Map<CreatorId, SettlementItem[]>`
   (`batcher.ts:34`, `add()` `:46-51`). A single timer fires every `BATCH_INTERVAL_MS`
   (default 4000 ms, `config.ts:59`) → `flushAll()` (`batcher.ts:58-92`). For each
   creator with pending items, the batch is detached (`:86`) and `settleOne()` runs.
4. **Per-creator settle (`batcher.ts:94-114`).** `settleOne` sums item amounts in
   BigInt micro-units via `parseUsdc`, formats the total (`:95-96`), then calls
   `circle.settleBatch({ creatorId, items, total })` **once per creator per window**
   (`:98`). On success it credits `creator.accrued += settledTotal` and increments
   `creator.settlements` in the in-memory store (`:99-101`). On failure the items are
   **re-queued** (`:109-111`) so nothing is lost.
5. **Mock settlement (`circle.mock.ts:24-32`).** Waits ~25 ms (simulated latency),
   then returns:
   - `txRef` = `0x` + 64 hex chars from `randomBytes(32)` (`fakeTxRef`, `:17-19`) —
     a **fake-but-realistic** tx hash, regenerated each call (carries no identity).
   - `settledTotal` = `input.total` (echoed back).
   - `itemCount` = `input.items.length` (a count, not a list of identities).
6. **Logging (`app.ts:42-48`).** `onSettled` logs `{ creatorId, txRef, total, items }`;
   `onError` logs `{ creatorId, err }`. No fan field is logged.

Net: in mock mode N per-second ticks for a creator collapse into one `settleBatch`
call per 4 s window, producing one random anonymous `txRef`, and the creator's
anonymous accrued balance grows. The timing correlation between an individual tip and
a settlement event is broken by the windowed aggregation.

---

## 3. The real adapter — coded vs gated, and the confirmed Arc constants

### Already coded and functional
- **viem clients (`circle.real.ts:104-144`).** Constructor builds a `WalletClient`
  and `PublicClient` over the Arc RPC (`createWalletClient` / `createPublicClient`,
  transport `http(cfg.arcRpcUrl)`), chain = `arcTestnet` imported from `viem/chains`
  (`:66`). Settler account derived from `SETTLER_PRIVATE_KEY` via
  `privateKeyToAccount` (`:116`), with `0x`-prefix normalization (`:112-114`).
- **Constructor guards.** Throws if `SETTLER_PRIVATE_KEY` is empty (`:107-111`) and if
  `USDC_ADDRESS` is not a valid address (`:132-137`). Note: the missing-key throw is
  partly redundant with `assertRealConfig` (see §4) but is a real fail-fast.
- **`withdraw` (`:223-248`)** — REAL. Validates `toAddress` via `isAddress`, parses
  amount to atomic (6 decimals), guards `> 0`, then `writeContract` ERC-20 `transfer`
  on `this.usdc` and `waitForTransactionReceipt`. Returns the tx hash as `txRef`. This
  executes for real once the settler key holds USDC + native gas on Arc.
- **`gatewayBalance` (`:365-387`)** — REAL read against the public Gateway REST
  balances endpoint (`POST ${gatewayBase}/v1/balances`), reading only the settler's own
  address as `depositor`. Not on the port; provided for smoke checks. No fan data.
- **`settleBatch` steps 1–2 (`:165-197`)** — REAL. Re-derives the total from items in
  atomic USDC and asserts it equals the batcher's pre-summed `total`, refusing a
  mismatched batch (`:175-185`); resolves the creator payout address (`:189`); builds the
  request object with the confirmed Arc CAIP-2 network id.

### Coded but gated / throwing (NOT functional)
- **`submitGatewaySettlement` (`:303-357`)** — the on-chain submit step (step 3 of
  `settleBatch`). It builds a fully-formed x402 `requirements` object
  (scheme `exact`, network, asset, amount, `payTo`, `maxTimeoutSeconds: 345600`, and
  `extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: <Gateway Wallet> }`,
  `:312-326`), but the actual REST `fetch` is left **commented out** (`:331-341`) and
  the method **unconditionally `throw`s** (`:349-356`). The intended inputs
  (`requirements`, `cfg.circleApiKey`, `gatewayBase`) are `void`-referenced (`:345-347`)
  so they aren't flagged unused. Consequence: any real `settleBatch` with ≥1 item
  throws; the batcher catches it and **re-queues** the items (`batcher.ts:108-113`),
  so a `MOCK=false` deployment without the missing piece would loop without ever
  settling.
- **`resolveCreatorPayoutAddress` (`:269-276`)** — partial. Accepts a `creatorId`
  that already **is** a `0x` address; otherwise throws because no creator→address
  registry is wired into the adapter yet (TODO at `:264-267`).

### Confirmed Arc constants found in code
All tagged CONFIRMED in `circle.real.ts` (sourced by the author from the
`circlefin/arc-nanopayments` reference; file:line citations into that repo appear in
the header comment `:17-50` and inline):

| Constant | Value | Where in this repo | Independently verified? |
|---|---|---|---|
| Arc CAIP-2 network id | `eip155:5042002` | `circle.real.ts:196-197` (`:30` comment) | **Yes** — chain id `5042002` matches viem's shipped `arcTestnet` (`viem/_esm/chains/definitions/arcTestnet.js:3`) |
| Arc chain id | `5042002` (via `arcTestnet`) | imported `:66`, used `:124,129,241` | **Yes** — viem 2.52.2 ships `arcTestnet` with `id: 5042002`; native currency = USDC, 18 decimals |
| USDC address (Arc testnet) | `0x3600000000000000000000000000000000000000` | error-message + checklist `:135,396` (actual value comes from `cfg.usdcAddress`) | Asserted valid at runtime via `isAddress` (`:132`); not hardcoded as the operative value |
| Gateway Wallet (verifyingContract) | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` | `circle.real.ts:324` (`:32` comment) | From reference; testnet only |
| Gateway REST host | `https://gateway-api-testnet.circle.com` (default) | `DEFAULT_GATEWAY_BASE` `:93`; balances path `/v1/balances` `:366` | From reference; overridable via `CIRCLE_GATEWAY_URL` |
| Arc CCTP / Gateway domain | `26` (`ARC_GATEWAY_DOMAIN`) | `:84`, used `:374,385` | From reference; testnet only |
| USDC ERC-20 decimals | `6` (`USDC_DECIMALS`) | `:77` | Matches `server/src/usdc.ts:11` |
| Arc RPC URL | `https://rpc.testnet.arc.network` | default in `config.ts:62` / `.env.example` | Matches viem `arcTestnet` rpcUrls |

Note on decimals: native gas on Arc is USDC with **18** decimals (viem `arcTestnet`,
and comment `:36`), but the **ERC-20 USDC amount unit is 6 decimals** (`:76-77`) — the
code uses 6 for all amount math, which is correct for token transfers.

### Real SDK referenced (but NOT imported)
- **`@circle-fin/x402-batching`** — the official Circle x402-batching SDK
  (header comment `:23-28`):
  - `GatewayClient` (`.../client`) — payer + withdraw side.
  - `BatchFacilitatorClient` (`.../server`) — seller/facilitator side:
    `.verify(payload, requirements)` then `.settle(payload, requirements)` aggregates
    signed off-chain authorizations into one gasless on-chain settlement.
- It is **deliberately not a dependency** of this server (a sibling agent owns
  `package.json`); importing it would fail typecheck (TS2307). The author chose to use
  `viem` (which is a dependency and ships `arcTestnet`) for the on-chain paths and to
  gate the SDK-only settlement step. Rationale documented at `:42-50`.

---

## 4. Exactly what is missing to settle real USDC on Arc

To flip `MOCK=false` and settle batched tips for real (the GO LIVE CHECKLIST at
`circle.real.ts:390-412` lists most of this):

1. **The Gateway batch-settlement route — the single hard blocker** (`:349-356`,
   TODO `:402-405`). Either:
   - **(A)** add `@circle-fin/x402-batching` and call
     `BatchFacilitatorClient.settle(payload, requirements)`, mapping its `transaction`
     to `txRef`; **or**
   - **(B)** confirm with Circle DevRel the exact pure-REST route (the author's guess
     is `POST ${gatewayBase}/v1/x402/settle`), the auth header (likely
     `Bearer cfg.circleApiKey`), and whether one aggregated creator settlement is a
     single call or requires the individual per-auth signed payloads — then enable the
     commented `fetch` (`:331-341`).
   Until this is done, every real `settleBatch` throws and items re-queue indefinitely.
2. **Creator → payout-address mapping** (`:269-276`, TODO `:264-267`,
   `:406-407`). Today only a `creatorId` that already is a `0x` address works. Need to
   inject a `resolveCreatorAddress(creatorId)` lookup from the store, or have the
   batcher pass the creator payout address inside `SettleBatchInput`. (Creator-only; no
   fan data involved.)
3. **Secrets / env** (enforced by `assertRealConfig`, `config.ts:76-92`). When
   `MOCK=false` these must be set or startup fails fast:
   `UNLINK_API_KEY`, `UNLINK_ENGINE_URL`, `CIRCLE_API_KEY`, `CIRCLE_GATEWAY_URL`,
   `USDC_ADDRESS`, `SETTLER_PRIVATE_KEY`, `ARC_RPC_URL`. In `.env.example`,
   `CIRCLE_API_KEY`, `CIRCLE_GATEWAY_URL`, `USDC_ADDRESS`, and `SETTLER_PRIVATE_KEY`
   are **blank** — **no Circle API key exists yet** (called out at `:398`). The settler
   wallet must also be **funded** with USDC + native gas on Arc.
4. **Important gap — `settleBatch` does not actually use `CIRCLE_API_KEY` / RPC to
   move funds yet.** Even with all env set, settlement only constructs a request and
   throws. `assertRealConfig` requires the key to start, but the key is currently only
   `void`-referenced (`:346`); it is consumed for real only once path (A) or (B) above
   is implemented.
5. **Arc mainnet** (TODO `:408-409`): swap the viem `chain` (mainnet `arcTestnet`
   equivalent once viem ships it), USDC address, Gateway Wallet, and CCTP domain for
   mainnet values — all four marked "CONFIRM with DevRel".

Not blocking: `withdraw` is already a working real same-chain transfer (the checklist
notes this, `:411`). Cross-chain payout would require switching to the SDK's
`gateway.withdraw(amount, { chain, recipient })` (returns `{ mintTxHash, ... }`,
reference `:36-38`, `:218-221`).

---

## 5. PRIVACY — does anything in the settlement path leak a supporter identity or a supporter→creator link?

**No.** The supporter (fan) identity and the fan→creator link do **not** reach the
settlement layer. Confirmed at every hop:

- **`fanAccountId` is stripped at ingest.** `routes.ts:138-144` constructs the
  settlement item with `creatorId`, `amount`, `nonce`, `ts` only — `fanAccountId` is
  explicitly excluded (inline comment line 138). `fanAccountId` is used **before** that
  point solely for the fan's own private balance/nonce bookkeeping (`routes.ts:113-136`)
  and for fan-only views (`/api/me/spent`, `routes.ts:150-163`).
- **The port type forbids it by construction.** `SettlementItem`
  (`ports/circle.ts:21-26`) has no fan field, and its doc-comment states the omission
  is deliberate (`:17-19`). `SettleBatchInput` (`:28-34`) is `{ creatorId, items, total }`
  — creator-only. `SettleBatchResult` (`:36-41`) is `{ txRef, settledTotal, itemCount }`,
  documented "Anonymous: no fan identities" (`:37`).
- **`txRef` carries nothing.** Mock: random 32-byte hex (`circle.mock.ts:17-19`),
  independent of any input. Real: it would be the Gateway settlement id / on-chain tx
  hash (`circle.real.ts:192-204`), which references the creator payout only.
- **The aggregation itself removes the link.** The batcher settles **per creator**, one
  call per window, summing N tips into a single creator-only total
  (`batcher.ts:94-101`). There is no per-fan settlement and no fan list anywhere in the
  batch. Even the residual fields (`nonce`, `ts`) on each item are not fan identifiers —
  `nonce` is a per-fan anti-replay counter and `ts` a timestamp, neither tied to an
  identity once `fanAccountId` is dropped, and neither is forwarded by the real adapter
  (it sends only `payTo`, `amount`, `network` — `circle.real.ts:192-197`).
- **Logs don't leak it.** Batcher events `onSettled`/`onError` only carry
  `creatorId`, `txRef`, `total`, `itemCount` / `error` (`batcher.ts:22-31, 102-113`),
  and the wiring in `app.ts:42-48` logs exactly those fields. No `fanAccountId` is
  logged anywhere in the settlement path.
- **The real adapter reinforces this.** Its header (`circle.real.ts:12-15`) and the
  `resolveCreatorPayoutAddress` doc (`:254-267`) repeatedly state the mapping is
  creator-only and no fan data is read, derived, or forwarded. `gatewayBalance`
  (`:365-387`) reads only the settler's own depositor address.

**Direct answer:** `fanAccountId` does **not** reach the settlement layer. It is
dropped at `routes.ts:138`, is absent from the port types, and appears nowhere in
`batcher.ts`, `circle.mock.ts`, or `circle.real.ts`. The privacy design holds in both
mock and (the gated) real paths. The only residual per-item metadata that survives into
the batcher (`nonce`, `ts`) is not forwarded on-chain by the real adapter and is not a
supporter identifier.

---

## Appendix — quick verdict

- **Arc settlement (batched USDC via Circle Gateway): MOCK only.** Real path is
  fully scaffolded with confirmed Arc constants and a real viem client, but the
  Gateway submit step throws on purpose (one unconfirmed wire format + missing API
  key + missing creator-address registry). Not live.
- **Arc withdraw (USDC out to a public address): real and working** in `MOCK=false`,
  pending a funded settler key.
- **Privacy: clean.** No supporter identity or supporter→creator link reaches or leaks
  from settlement, in either mode.
