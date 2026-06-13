# Audit — Consolidated Summary (Wave 1)

Source reports in this folder: `backend.md`, `wallets-dynamic.md`, `arc-circle.md`, `versus-analysis.md`.

## Headline
The MANUAL hold-to-support money-shot already works end-to-end in MOCK mode, and the privacy property holds: no supporter→creator link exists anywhere in the backend. Everything missing is real-mode integration (keys + DevRel), which is out of scope for the mock demo.

## Backend (Fastify/TS) — `backend.md`
- All 6 endpoints DONE in mock: onboard, deposit, tip (the per-second mechanism), me/spent, creator/:id/balance, withdraw (+ /health).
- `/api/tip` = the per-second support: validate → strict-monotonic nonce (anti-replay) → signature shape → funds check → debit → push to per-creator batch. `fanAccountId` is NEVER forwarded to settlement.
- Adapters: Unlink admin (mock OK; real `registerFan` gated, real `issueAuthToken` wired but no HTTP route); Circle settlement (mock OK; real `settleBatch` gated; real `withdraw` is a genuine viem transfer).
- Anonymous creator total = `creator.accrued`, credited only by the batcher post-settlement. No fan→creator map in the store, the settlement item, or the auth token.
- Minor: contract says "tip" not "support" (frozen); `BATCH_INTERVAL_MS=4000` makes the creator total lag ~4s.

## Wallets (Dynamic) — `wallets-dynamic.md`
- Currently DEMO/simulated: `NEXT_PUBLIC_DYNAMIC_ENV_ID` empty → `DYNAMIC_ENABLED=false` → `useWalletAddress()` returns a constant mock address. UI honestly labels it.
- Real connection needs only a valid env id from app.dynamic.xyz. Demo wallet is acceptable for submission.
- No supporter→creator leak client-side; the on-chain anonymization (Dynamic sign + Unlink routing) is still a TODO stub in `lib/tip.ts` — privacy is currently architectural, not yet live private routing.

## Arc / Circle / USDC — `arc-circle.md`
- `settleBatch`: mock works; real is coded but throws before the network call (Gateway route unconfirmed) → real settlement effectively absent.
- `withdraw`: mock works; real is a genuine on-chain ERC-20 USDC transfer via viem.
- Confirmed Arc constants (verified against viem's `arcTestnet`): chain id 5042002, USDC `0x3600…0000`, Gateway host `gateway-api-testnet.circle.com`, CCTP domain 26.
- Missing for real USDC settlement: Circle API key + the Gateway batch-settlement route + a creator→address registry + a funded settler key.
- Privacy: clean. `fanAccountId` never reaches settlement; logs carry only creatorId/txRef/total/itemCount.

## Versus (prior winner) — `versus-analysis.md`
- Versus is pay-per-SEGMENT (5s/$0.01) via Yellow Network state channels; creator tokens on a sigmoid bonding curve; 70/20/10 split on-chain. It is PUBLIC.
- The supporter→creator edge is exposed in 3 on-chain places + the DB schema co-locates viewer + creator + balance in one row.
- Reuse only the per-tick SIGNING PATTERN (monotonic version + serialized queue) — over Dynamic, not Nitrolite.
- Deliberately DROP: Yellow/Nitrolite, creator tokens + bonding curve, VideoRegistry/CCTP trail, all video/AI machinery.
- CRITICAL cross-finding: the privacy claim depends on the BATCHED settlement path actually shipping (aggregate across fans to break temporal/amount correlation). A per-tick on-chain transfer would leak the same supporter→creator edge Versus exposes.

## Readiness for the mock demo
READY. The hold-to-support flow, anonymous creator total, and no-leak privacy all hold in mock. Real settlement, real wallet, and live Unlink routing are post-submission work.
