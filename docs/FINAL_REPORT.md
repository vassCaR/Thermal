# Ghost Tips — Final Report

Generated: 2026-06-13, early morning (America/New_York). Prepared for the
10:00 NY read. Autonomous overnight pass on the existing project.

Locked decisions for this run: keep the TS/Fastify backend; MVP = clean mock
end-to-end; run the loop now; commit + push after each green iteration.

---

## 1. What was done, section by section

### Frontend visual (already in place from the prior pass, verified)
Blue Dither background (exact preferred props, `enableMouseInteraction={false}`),
white logo + `#3459b5` halo (CSS), floating "+" deposit button, hamburger sidebar
with About Us / How It Works anchors, white hero title, Montserrat typography,
hover effects, and a fully English UI.

### Typography & design system (new)
One coherent system in `tailwind.config.ts` + `app/globals.css`: Montserrat across
the app, type roles (`.gt-title`, `.gt-h2`, `.subtitle` lowercase, `.gt-body`),
button states (hover lift, focus-visible ring, disabled, loading text), consistent
spacing/radii. A gradient **legibility overlay** in `DitherBackground` plus a heading
text-shadow keep white text readable over the bright dithering.

### Motion & polish (new)
`motion/react`: staggered hero entrance, card fade-ups, About/How animate on scroll,
sidebar `AnimatePresence` slide-in, per-route page transitions (`app/template.tsx`),
button hover/press, counter "pops", a support-button pulse. `MotionConfig
reducedMotion="user"` + a CSS `prefers-reduced-motion` block respect accessibility.

### Backend (kept TS/Fastify) + review
Audited; all six endpoints are wired and working in mock mode. A dedicated review
pass led to three fixes (see section 3). Real Unlink/Circle wiring remains gated
(keys + DevRel answers) — out of scope for an unattended night.

### Tests (new)
Playwright e2e suite (`web/e2e`, `npm run test:e2e`), 10 tests. **Latest: 10/10
passed.**

### Docs (new)
`/docs`: ARCHITECTURE, BACKEND, FRONTEND, TESTS, SETUP, CHANGELOG, this report.

---

## 2. How each part works

- **Frontend** — Next.js 15 App Router. `lib/client.ts` calls the API over REST,
  typed by the shared contract. `useWalletAddress()` returns a Dynamic wallet when
  `NEXT_PUBLIC_DYNAMIC_ENV_ID` is set, else a simulated demo address.
- **Backend** — Fastify, mock-first. `routes.ts` validates input; `batcher.ts`
  aggregates per-creator tips and settles (mock); `store.ts` keeps no fan→creator
  link. `buildAdapters` switches mock/real.
- **Communication** — browser → `http://localhost:8787` REST. `MOCK=true` means no
  keys required.
- **Wallet** — Dynamic (no seed phrase) or demo fallback.
- **Tests** — Playwright drives the real UI against the mock backend, including the
  full money path (onboard → deposit → per-second tip → withdraw).

---

## 3. Bugs found and how they were fixed

1. **Tipping returned HTTP 401 in the browser** — `web/lib/tip.ts` sent the literal
   `"MOCK_SIGNATURE"`, which fails the server `isHex` check. Now sends a hex-shaped
   placeholder. Verified live and by the full-flow e2e test.
2. **CSS build error** (`@apply font-montserrat`) — decoupled from the Tailwind
   utility by using the `--font-montserrat` variable directly; dev reloads cleanly.
3. **Backend review fixes** — H2 (cap `parseUsdc` input length, anti-DoS),
   M3 (integer/non-negative `nonce`/`ts`), H1 (global error handler so real-mode
   throws don't leak raw 500 bodies). Re-verified: server typecheck + smoke green,
   10/10 e2e green.

No console errors or hydration warnings on load (guarded by an e2e test).

---

## 4. TODO / out of MVP scope

- **Real Unlink/Circle wiring** (blocked, needs keys + DevRel answers): thread the
  client-derived Unlink registration payload through the port; finish the Circle
  Gateway settlement route; add a creator→address registry for real withdrawals;
  expose an `auth-token` HTTP route; replace the `tip.ts` mock signer with real
  Dynamic signing + Unlink browser transfer.
- **Production hardening**: rate-limiting on `/api/tip`, CORS allowlist.
- **Cleanup**: delete `server/src/__probe.ts` (dead scratch file — left for you to
  remove per the no-delete rule).
- **Deeper mobile/responsive QA** beyond the current breakpoints.

---

## 5. How to run / test

```bash
cd /home/jean/ghost-tips
npm --prefix server run dev        # API :8787 (mock)
npm --prefix web run dev           # web :3000

# e2e (both servers up):
cd web && npx playwright install chromium && npm run test:e2e
```

Full details in `docs/SETUP.md` and `docs/TESTS.md`. Screenshots of the final UI
were written to `C:\Users\jeane\Downloads\ghosttips_home.png` and
`ghosttips_dashboard.png`.

---

## 6. Decisions made autonomously (no blocking) + open questions

Decided with sensible defaults: sidebar = same-page anchors; logo = CSS white +
blue halo; "+" = deposit funds; backend kept in TS; Montserrat used app-wide;
legibility overlay added; animation intensity kept subtle; review fixes H2/M3/H1
applied, M1/M2/L1/L3 deferred as MVP-acceptable.

Open for you:
- Provide Unlink/Circle keys + DevRel answers to unlock real mode.
- Approve deletion of `server/src/__probe.ts`.
- Decide if/when to do production hardening (rate-limit, CORS).

---

## 7. Scheduling note

I cannot trigger a timed delivery myself. This report is a static `.md` for the
10:00 NY read. If you want a real scheduled action (e.g. run tests + email the
report each morning), the options are a system `cron` job or a GitHub Action on
the `vassCaR/ghost-tips` repo — say the word and I will set one up.
