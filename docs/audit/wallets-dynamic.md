# Audit — Wallets / Dynamic

**Scope:** wallet connection layer of Ghost Tips (`web/`), using Dynamic (`@dynamic-labs`).
**Mode:** read-only audit. No code changed.
**Date:** 2026-06-13

---

## TL;DR

The wallet integration is **wired correctly but currently running in DEMO mode** (simulated
wallet). Dynamic is installed and the provider is conditionally mounted, but
`NEXT_PUBLIC_DYNAMIC_ENV_ID` is **empty** in `web/.env.local`, so `DYNAMIC_ENABLED` is `false`
and every screen uses a hard-coded `MOCK_ADDRESS`. No real wallet is ever connected today.

The only thing needed to flip to a REAL connection is a valid `NEXT_PUBLIC_DYNAMIC_ENV_ID`.
Per the product decision, the **demo wallet is acceptable for submission** — no change required
to ship.

One real privacy note: the **mock address is sent to the backend** (`/api/onboard`,
`/api/withdraw`). This is fine in demo (the value is a constant), but the seam that would
actually anonymize the fan→creator link (`signTip` / Unlink routing) is still a TODO stub.

---

## 1. Real connection vs demo/simulated fallback

**Current state: DEMO / simulated.**

The switch lives in `web/lib/wallet.tsx:5-7`:

```ts
export const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ?? "";   // wallet.tsx:5
export const DYNAMIC_ENABLED =
  DYNAMIC_ENV_ID.length > 0 && DYNAMIC_ENV_ID !== "REPLACE_WITH_DYNAMIC_ENV_ID";  // wallet.tsx:6-7
```

`DYNAMIC_ENABLED` is `true` only when the env var is set **and** is not the placeholder string
`REPLACE_WITH_DYNAMIC_ENV_ID`.

In `web/.env.local:2` the value is empty:

```
NEXT_PUBLIC_DYNAMIC_ENV_ID=
```

`web/.env.example:2` is also empty. Therefore `DYNAMIC_ENV_ID === ""`, `DYNAMIC_ENABLED === false`,
and the app is in demo mode right now.

**The MOCK_ADDRESS fallback** (`web/lib/wallet.tsx:9-25`):

```ts
export const MOCK_ADDRESS = "0xMOCKfa000000000000000000000000000000abcd";  // wallet.tsx:10

export function useWalletAddress(): string {
  if (!DYNAMIC_ENABLED) return MOCK_ADDRESS;                  // wallet.tsx:21  ← demo path
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { primaryWallet } = useDynamicContext();              // wallet.tsx:23  ← real path
  return primaryWallet?.address ?? MOCK_ADDRESS;              // wallet.tsx:24
}
```

- **Demo (today):** `useWalletAddress()` short-circuits at line 21 and returns the constant
  `MOCK_ADDRESS`. `useDynamicContext()` is never called, so no Dynamic context is required.
- **Real (env set):** it reads `primaryWallet.address` from Dynamic, falling back to
  `MOCK_ADDRESS` only if no wallet is connected yet.

Note the deliberate `rules-of-hooks` eslint-disable at line 22: there's a conditional early
return *before* a hook call. The code comment (lines 12-19) argues this is safe because
`DYNAMIC_ENABLED` is an environment constant — it cannot change during the component lifetime,
so the hook-call order is stable per render session. This is a reasonable assumption for a demo,
though it is technically an anti-pattern (if the env value ever changed between renders, the hook
order would break). Not a problem in practice here.

**The UI also branches on the same flag** — `web/components/ConnectButton.tsx:6-16`:

```ts
export function ConnectButton() {
  if (!DYNAMIC_ENABLED) {
    return (
      <span className="text-xs text-ghost-muted">
        Mode démo · wallet simulé — ajoute NEXT_PUBLIC_DYNAMIC_ENV_ID dans .env.local …
      </span>                                                 // ConnectButton.tsx:9-13
    );
  }
  return <DynamicWidget />;                                   // ConnectButton.tsx:15
}
```

So in demo mode the user sees a "Mode démo · wallet simulé" notice instead of the Dynamic connect
widget. This is visible and honest — a reviewer will know it's simulated.

---

## 2. Installed Dynamic packages & provider wiring

**Direct dependencies** (`web/package.json:14-15`), confirmed installed at the same version in
`node_modules`:

| Package                          | Declared (package.json) | Installed (node_modules) |
|----------------------------------|-------------------------|--------------------------|
| `@dynamic-labs/sdk-react-core`   | `^4.88.5`               | `4.88.5`                 |
| `@dynamic-labs/ethereum`         | `^4.88.5`               | `4.88.5`                 |

The lockfile (`web/package-lock.json`) pulls the full Dynamic dependency tree (utils, waas,
waas-evm, wallet-book, etc.) all pinned to `4.88.5`. No version mismatch.

Supporting on-chain libs present: `viem ^2.52.2` (`package.json:24`). **Not present:** any Unlink
SDK (`@unlink-xyz/sdk`) — referenced only as a TODO in `web/lib/tip.ts` (see §4), not installed.

**Provider wiring** — `web/app/providers.tsx:14-29`:

```ts
export function Providers({ children }: { children: React.ReactNode }) {
  const inner = DYNAMIC_ENABLED ? (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,                        // providers.tsx:18
        walletConnectors: [EthereumWalletConnectors],         // providers.tsx:19
      }}
    >
      {children}
    </DynamicContextProvider>
  ) : (
    <>{children}</>                                           // providers.tsx:25  ← demo: no provider
  );
  return <MotionConfig reducedMotion="user">{inner}</MotionConfig>;  // providers.tsx:28
}
```

Key points:
- The `DynamicContextProvider` is **only mounted when `DYNAMIC_ENABLED` is true**. In demo mode
  children render with no Dynamic provider at all (line 25). This is consistent with
  `useWalletAddress` never calling `useDynamicContext()` in demo, so there's no "context missing"
  runtime error.
- Configured with the single `EthereumWalletConnectors` connector (EVM only). No Solana / other
  chain connectors, no WalletConnect projectId, no custom auth — minimal Dynamic config.
- `environmentId` is fed straight from `DYNAMIC_ENV_ID`.

**Consumers of the wallet hook** (`grep` across `web/`, excluding `node_modules`/`.next`):
- `web/app/page.tsx:14` — `const address = useWalletAddress();` → passed to `api.onboard({ dynamicAddress: address })` (`page.tsx:25`).
- `web/app/dashboard/page.tsx:16` — `const address = useWalletAddress();` → passed to `api.withdraw({ creatorId, toAddress: address })` (`dashboard/page.tsx:39`).

`useDynamicContext` is imported/used only in `web/lib/wallet.tsx`. `DynamicWidget` only in
`web/components/ConnectButton.tsx`. `DynamicContextProvider` + `EthereumWalletConnectors` only in
`web/app/providers.tsx`. Clean, centralized — the rest of the app never touches Dynamic directly.

---

## 3. What's needed for a REAL wallet connection

To flip from demo to a real Dynamic connection, the **only required change** is a valid
environment ID:

1. **Real `NEXT_PUBLIC_DYNAMIC_ENV_ID`.** Create a project at https://app.dynamic.xyz (free tier),
   copy the Environment ID, and set it in `web/.env.local:2`. Restart `next dev` (the value is
   read at build/SSR time via `process.env`). As soon as it's non-empty and not the placeholder,
   `DYNAMIC_ENABLED` becomes `true`, the `DynamicContextProvider` mounts, and `<DynamicWidget />`
   renders a working connect button.

2. **Connectors/config — already sufficient for basic EVM.** `EthereumWalletConnectors` is already
   wired (`providers.tsx:19`). For a fuller setup you *might* add:
   - WalletConnect projectId (for mobile wallets) — optional, configured in the Dynamic dashboard.
   - Allowed origins / domains in the Dynamic dashboard so the env ID accepts your dev/prod URL.
   - Additional chain connectors only if you need non-EVM. Not required for the current EVM flow.

   No code change is strictly necessary beyond the env var for a baseline real connection.

3. **(Out of scope of "connection", but the actual product value):** signing + private routing is
   still stubbed — see §4 / `web/lib/tip.ts`. A real *connection* works with just the env ID, but
   real *private tipping* needs the Dynamic signature + Unlink transfer implemented.

**Is a real connection needed for the demo?**
**No.** Per the stated product decision, the demo wallet is acceptable for submission. The demo
path is self-consistent and visibly labeled ("Mode démo · wallet simulé"), the backend runs in
mock mode and "accepts everything" (per the comment in `wallet.tsx:15`), and `signTip` returns a
hex-shaped placeholder the mock server accepts (`tip.ts:29-30`). The app boots and the full
fan/creator flow is demoable end-to-end without any Dynamic key. Adding a real key is a nice-to-have
for the live demo, not a blocker.

---

## 4. Privacy considerations — does the wallet address leak?

**Design intent (good).** The data model is explicitly built to avoid linking a supporter to a
creator:
- `FanAccountId` is documented as an *opaque* id that "never reveals the real address"
  (`web/lib/contract.ts:18-19`).
- `CreatorId` is a public handle (`ghost:alice`), "not an address" (`contract.ts:15-16`).
- The tip authorization (`TipAuthorization`, `contract.ts:25-44`) carries `fanAccountId` —
  **not** the wallet address — when tipping. So the per-second tip stream does not expose the
  fan's address to the creator or in the tip payload.
- Dashboard copy reinforces this: "No fan identity is stored. It is impossible to know who
  supported you." (`web/app/dashboard/page.tsx:69`).

**Where the address DOES travel (worth flagging):**

1. **Onboarding** — `web/app/page.tsx:25`:
   ```ts
   const { fanAccountId } = await api.onboard({ dynamicAddress: address });
   ```
   The fan's wallet address (`OnboardReq.dynamicAddress`, `contract.ts:50-52`) is sent to the
   backend to mint the opaque `fanAccountId`. So the **server can see the mapping
   address → fanAccountId**. The privacy guarantee is therefore "the *creator* and the *chain*
   can't link fan→creator", **not** "the server can't". The backend is a trust point. In demo this
   is moot (the address is the constant `MOCK_ADDRESS`), but for a real deployment this is the place
   where deanonymization would be possible server-side. (Backend privacy model is out of this
   audit's file scope — see `docs/BACKEND.md` if confirming.)

2. **Withdraw** — `web/app/dashboard/page.tsx:39`:
   ```ts
   const r = await api.withdraw({ creatorId, toAddress: address });
   ```
   The dashboard sends the **current wallet address as the creator's payout address**
   (`WithdrawReq.toAddress`, `contract.ts:79-82`). This couples whoever is viewing the dashboard to
   the creator's withdrawal. Two notes:
   - In demo, `address` is `MOCK_ADDRESS`, so every "creator" withdraws to the same mock address —
     fine for demo, but means the dashboard isn't actually creator-scoped to a real wallet.
   - In a real setup, the withdrawal address is the creator's own — that's expected and not a
     fan-linkage leak. It does not connect a *supporter* to the creator; it only reveals the
     creator's own payout wallet.

3. **No leakage to creator-facing surfaces.** The creator dashboard fetches only an aggregate total
   (`api.creatorBalance(creatorId)`, `dashboard/page.tsx:24`) — no fan addresses, no per-fan
   breakdown. The creator page / tip flow uses `fanAccountId`, never the raw address. So the
   **fan→creator link is not exposed to the creator** in the current client code.

4. **The actual anonymization is still a stub.** `web/lib/tip.ts:1-31` is the seam where the fan
   would (a) sign the tip with the Dynamic wallet and (b) route the transfer privately via
   `@unlink-xyz/sdk/browser` ("c'est ça qui cache le lien fan→créateur on-chain", `tip.ts:12`).
   Today `signTip` returns a placeholder signature (`"0x" + "0".repeat(130)`, `tip.ts:29`) and does
   **no** on-chain routing. So in the current build there is no real on-chain privacy yet — but
   there's also no real on-chain transaction, so nothing leaks on-chain either. The privacy claim is
   architectural/aspirational at this stage, backed by the data model, not yet by live Unlink routing.

**Verdict on privacy:** No supporter→creator leak in the client today. The wallet address reaches
the backend at onboarding (a server-side trust point, irrelevant in demo since it's a constant),
and is used as the creator's own payout address at withdraw (expected, not a fan leak). The
fan-anonymity property depends on the Unlink routing in `tip.ts`, which is still a documented TODO.

---

## File reference

| File | Role |
|------|------|
| `web/lib/wallet.tsx:5-25` | `DYNAMIC_ENABLED` flag, `MOCK_ADDRESS`, `useWalletAddress()` |
| `web/app/providers.tsx:14-29` | Conditional `DynamicContextProvider` (EVM connector) |
| `web/components/ConnectButton.tsx:6-16` | Demo notice vs `<DynamicWidget />` |
| `web/.env.local:2` | `NEXT_PUBLIC_DYNAMIC_ENV_ID=` (empty → demo) |
| `web/.env.example:2` | Same key, empty placeholder |
| `web/package.json:14-15` | `@dynamic-labs/{sdk-react-core,ethereum} ^4.88.5` |
| `web/lib/contract.ts:18,25-44,50-52,79-82` | `FanAccountId` opacity, `TipAuthorization`, onboard/withdraw payloads |
| `web/lib/client.ts:39-48` | API client (onboard/withdraw carry the address) |
| `web/app/page.tsx:14,25` | `useWalletAddress()` → `onboard({ dynamicAddress })` |
| `web/app/dashboard/page.tsx:16,39` | `useWalletAddress()` → `withdraw({ toAddress })` |
| `web/lib/tip.ts:1-31` | Stubbed sign + (missing) Unlink private routing |
