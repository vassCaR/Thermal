# Tests (end-to-end)

Tooling: **Playwright** (`@playwright/test`). Config: `web/playwright.config.ts`
(serial, 1 worker, 1 retry, swiftshader GL args so the WebGL Dither renders headlessly).

## Prerequisites

Both servers must be running:
- web: `npm --prefix web run dev` (http://localhost:3000)
- api: `npm --prefix server run dev` (http://localhost:8787, mock)

Browser (once): `cd web && npx playwright install chromium`.

## Run

```bash
cd /home/jean/ghost-tips/web
npm run test:e2e
# HTML report: web/playwright-report/ (npx playwright show-report)
```

## Coverage (10 tests)

`e2e/home.spec.ts`
- hero loads with title, logo and subtitle
- primary navigation buttons present
- no severe console errors on load (guards against hydration/runtime errors)

`e2e/navigation.spec.ts`
- hamburger opens the sidebar with About Us / How It Works links
- "View a Creator" navigates to a creator page
- "Creator Dashboard" navigates to the dashboard

`e2e/fan-deposit.spec.ts`
- creates a private fan account
- "+" deposit without an account prompts to create one
- deposit after onboarding shows a new balance

`e2e/full-flow.spec.ts`
- full money path: onboard -> deposit -> per-second tip -> withdraw (Arc settlement)

## Latest results

`10 passed (1.3m)` — 2026-06-13. All green against the mock backend.

## Notes

- Tests target the mock backend (no keys needed); they exercise the real UI flow
  and the real API routes in mock mode.
- The demo wallet (no `NEXT_PUBLIC_DYNAMIC_ENV_ID`) is used, so the wallet step
  needs no Dynamic account.
