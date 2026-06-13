# Setup

## Where the project lives

Develop from the WSL native filesystem: **`/home/jean/ghost-tips`**.
Do NOT run it from the OneDrive folder — OneDrive corrupts `node_modules` under WSL.
Canonical backup: GitHub `vassCaR/ghost-tips`.

## Prerequisites

- Node 22+, npm
- WSL (Ubuntu). Open the project in a WSL terminal.

## Install

```bash
cd /home/jean/ghost-tips
npm --prefix server install
npm --prefix web install
```

## Environment

**server/.env** (optional — the server defaults to `MOCK=true`, which needs no keys):

```
MOCK=true            # default; in-memory mock adapters, full demo works
PORT=8787
BATCH_INTERVAL_MS=4000
# For real mode (MOCK=false) — currently blocked on keys + DevRel answers:
# CIRCLE_API_KEY=...
# UNLINK_API_KEY=...
# SETTLER_PRIVATE_KEY=...
# UNLINK_ENV=arc-testnet
```

**web/.env.local**:

```
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_DYNAMIC_ENV_ID=          # optional; empty = simulated demo wallet
```

## Run (two terminals)

```bash
npm --prefix server run dev     # API on http://localhost:8787 (mock)
npm --prefix web run dev        # web on http://localhost:3000
```

Open http://localhost:3000 (WSL forwards localhost to the Windows browser).

## End-to-end tests

```bash
# both servers must be running first
cd /home/jean/ghost-tips/web
npx playwright install chromium     # once
npm run test:e2e
```

## Production build (web)

```bash
npm --prefix web run build && npm --prefix web run start
```
