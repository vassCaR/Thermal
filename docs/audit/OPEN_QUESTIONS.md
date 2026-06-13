# Open Questions (before Wave 2 build)

Grouped by theme. **BLOCKING** items need your answer before I build that part; the rest I will proceed on with the noted default unless you say otherwise.

## A. Scope of settlement for the submission
- **A1 (BLOCKING).** Keep everything MOCK for the demo (no keys, works today), or attempt REAL Circle/Arc settlement? Real is blocked on a Circle API key + the Gateway batch-settlement route (DevRel) + a creator→address registry. *Default if no answer: MOCK only — the money-shot is fully demoable in mock.*
- A2. Lower `BATCH_INTERVAL_MS` from 4000 to ~1000 so the creator total updates almost live on stage? *Default: yes, set 1000 for the demo.*

## B. Privacy hardening (from the Versus analysis)
- **B1 (BLOCKING for the pitch claim).** How strong must the anonymity be for the demo narrative? Options: (a) current per-creator batched mock is enough for the story, or (b) strengthen batching (aggregate across creators / rolling windows) to make "no temporal/amount correlation" airtight. *Default: (a) for the demo; document (b) as the production design.*
- B2. The real per-tick `withdraw` transfer would leak the supporter→creator edge (like Versus). Confirm we rely on the BATCHED `settleBatch` path for the privacy claim and never settle per-tick on-chain. *Default: yes.*

## C. Wallet
- C1. Real Dynamic connection for the demo, or keep the simulated demo wallet? *Default: demo wallet (acceptable per your earlier call).* If real: provide a `NEXT_PUBLIC_DYNAMIC_ENV_ID`.

## D. Naming / contract
- D1. The frozen contract uses "tip"; the UI says "support". Rename the contract to "support" (coordinated change across server + web), or keep "tip" internal and "support" in the UI? *Default: keep "tip" internal, "Support" in the UI (no churn).*

## E. Front (next session)
- E1. Beyond the hero + hold-to-support + sidebar + creator anonymous total: do you want creator profile pages, multiple featured creators, a "supporters count" (anonymous), or is the single featured-creator demo flow enough? *Default: single featured creator (ghost:alice) for the demo.*
- E2. The e2e suite (`web/e2e/*`) targets the OLD home (Create-account button, View-a-Creator link, floating +). The redesign removed those, so the suite needs realignment to the new UI (Support Creators hold button, Connect Wallet, right sidebar). *Default: I realign the e2e once the front is locked.*

## Unblocked / already decided
- Backend stays TS/Fastify. No AI agent in code (roadmap line only). Site in English. Mock-first. Demo is manual hold-to-support.
