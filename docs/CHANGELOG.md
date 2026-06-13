# Changelog

## 2026-06-13 — Overnight cleanup pass

### Added
- Coherent Tailwind **design system**: type roles (`.gt-title`, `.gt-h2`,
  `.subtitle`, `.gt-body`), button states (hover lift, focus-visible ring,
  disabled, loading text), consistent spacing/radii.
- **Legibility overlay** in `DitherBackground` + heading text-shadow so white
  text stays readable over the blue dithering.
- **Motion animations** (`motion/react`): hero/card entrances, sidebar
  `AnimatePresence`, page transitions (`app/template.tsx`), button hover/press,
  counter pops, support-button pulse. Global `MotionConfig reducedMotion="user"`
  + CSS `prefers-reduced-motion` guard.
- **Playwright e2e suite** (`web/e2e/*`, `playwright.config.ts`, `npm run test:e2e`):
  10 tests covering hero, sidebar, deposit, navigation, and the full money path.
- `/docs`: ARCHITECTURE, BACKEND, FRONTEND, TESTS, SETUP, CHANGELOG, FINAL_REPORT.

### Fixed
- **Tipping was broken (HTTP 401)** in the browser: `lib/tip.ts` sent the literal
  string `"MOCK_SIGNATURE"`, which fails the server's `isHex` check. Now sends a
  hex-shaped placeholder signature. Verified live and via the full-flow e2e test.

### Changed
- Dither background restored to the preferred **blue** (`#3459b5`),
  `enableMouseInteraction={false}`.

## Earlier this build (same hackathon)

### Added
- Blue Dither background, white logo + `#3459b5` halo (CSS), floating "+" deposit
  modal, hamburger sidebar with About Us / How It Works anchors, white hero title,
  Montserrat typography, hover effects.
- Full **English** UI (cards, buttons, state messages).
- Backend (Node/TS Fastify, mock-first): onboard / deposit / tip / me-spent /
  creator-balance / withdraw, per-creator batcher, in-memory store with no
  fan->creator mapping. Real Unlink/Circle adapters scaffolded behind ports
  (lazy SDK import so mock mode never loads the SDK).

### Notes
- Project moved to WSL native `/home/jean/ghost-tips` (OneDrive corrupts
  `node_modules`). Pushed to GitHub `vassCaR/ghost-tips`.
