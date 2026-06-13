# Frontend

Next.js 15 (App Router) + React 19 + Tailwind 3. All UI text is in English.

## Routes / components

| Path | File | Role |
|------|------|------|
| `/` | `app/page.tsx` | Hero + wallet card + become-a-fan card + nav + About/How sections |
| `/creator/[id]` | `app/creator/[id]/page.tsx` | Hold-to-support (per-second tipping), amount given |
| `/dashboard` | `app/dashboard/page.tsx` | Anonymous total received + withdraw |
| layout | `app/layout.tsx` | Montserrat font, Dither background, sidebar, floating "+" |
| transitions | `app/template.tsx` | Per-route fade/slide page transition |
| providers | `app/providers.tsx` | `MotionConfig reducedMotion="user"` + Dynamic provider |

Components: `DitherBackground` (+ `Dither/Dither.jsx` WebGL shader), `Sidebar`
(hamburger + slide-in), `FloatingDeposit` ("+" deposit modal), `ConnectButton`.

Libs: `lib/client.ts` (typed API client), `lib/contract.ts` (synced copy of
`shared/api.ts`), `lib/tip.ts` (tip signing seam — mock hex signature for now),
`lib/wallet.tsx` (Dynamic wallet or demo fallback), `lib/motion.ts` (animation variants).

## Design system

Defined in `tailwind.config.ts` + `app/globals.css`.

- Colors (`ghost.*`): `bg #18181A`, `panel #1F1F21`, `border #2E2E31`,
  `accent #3459b5` (blue, matches the Dither + logo), `accent2 #5B7FD4`,
  `muted #8A8A90`, `fg #FFFFFF`.
- Font: Montserrat everywhere (`--font-montserrat`). Headings get a text-shadow
  for legibility over the background.
- Type roles: `.gt-title` (hero), `.gt-h2` (section), `.subtitle` (lowercase
  eyebrow/subtitle), `.gt-body` (muted paragraph).
- Components: `.gt-panel` (translucent charcoal + blur), `.gt-btn` (blue primary,
  hover lift + focus ring + disabled), `.gt-btn-ghost` (outline), `.gt-logo`
  (white logo + #3459b5 outline/glow via CSS).
- Legibility: a gradient overlay in `DitherBackground` dims bright dither peaks so
  white text stays readable.

## Animations (motion)

`lib/motion.ts` exports `spring`, `fadeUp`, `container`. Transform/opacity only.

- Hero: staggered fade-up of logo / title / subtitle.
- Cards: fade-up on mount; About/How sections animate on scroll into view.
- Sidebar: `AnimatePresence` slide-in + backdrop fade.
- Floating deposit modal: `AnimatePresence` scale/fade.
- Buttons/links: `whileHover` lift + `whileTap` press.
- Counters (amount given, total received): scale "pop" on each change.
- Support button: gentle scale pulse while held.
- `MotionConfig reducedMotion="user"` + a CSS `prefers-reduced-motion` block
  disable/short-circuit motion for users who ask for it.

## Wallet

`useWalletAddress()` returns the Dynamic wallet address when
`NEXT_PUBLIC_DYNAMIC_ENV_ID` is set; otherwise a simulated demo address so the
app is fully usable without Dynamic keys.
