# Architecture

Ghost Tips — anonymous, per-second tipping for creators/activists. Nobody can
reconstruct who-supports-whom. Hackathon track: **Best Private Nano Payment App**
(Dynamic + Unlink + Arc).

## Repository layout

```
ghost-tips/
├── server/        Node/TypeScript + Fastify API (mock-first)
├── web/           Next.js 15 frontend (App Router)
├── shared/
│   └── api.ts     Frozen request/response contract (source of truth)
└── docs/          This documentation
```

Canonical location: WSL native `/home/jean/ghost-tips` + GitHub `vassCaR/ghost-tips`.
(The project is NOT developed from the OneDrive folder — OneDrive corrupts
`node_modules` under WSL.)

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind 3, Dynamic (wallets), Three.js (Dither background), motion (animations) |
| Backend | Node 22, TypeScript, Fastify 5, viem |
| Contract | `shared/api.ts` — typed REST contract, imported by the server and copied to `web/lib/contract.ts` |

There is no Python anywhere; the backend is TypeScript.

## How front and back communicate

```
Browser (Next.js)                         API (Fastify :8787)
  lib/client.ts  ──POST /api/onboard────►  routes.ts → adapters.unlink.registerFan
                 ──POST /api/deposit────►  credits in-memory balance
                 ──POST /api/tip────────►  validate → batcher → settle (mock)
                 ──GET  /api/me/spent───►  fan's own total
                 ──GET  /api/creator/:id/balance►  anonymous accrued total
                 ──POST /api/withdraw───►  flush batch → circle.withdraw
```

- The web app calls the API over REST through `web/lib/client.ts`, typed by the
  shared contract. Base URL = `NEXT_PUBLIC_API_URL` (default `http://localhost:8787`).
- `MOCK=true` (default) makes the server use in-memory mock adapters — the whole
  flow works with zero API keys. Real Unlink/Circle adapters are stubbed behind
  the same ports and activated with `MOCK=false` + keys (see BACKEND.md).

## Privacy model (what the design protects)

- PRIVATE: the fan→creator link, tip amounts, balances. The server stores no
  fan→creator mapping; the settlement batch carries no fan identity.
- PUBLIC (by nature of the real rails): entering/leaving the shielded pool
  (deposits/withdrawals) is visible on-chain; who-pays-whom is not.

See FRONTEND.md, BACKEND.md, TESTS.md, SETUP.md for details.
