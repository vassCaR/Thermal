# Ghost Tips — Frontend (`/web`)

Next.js (App Router) + Tailwind + Dynamic. Parle au serveur `/server` via `lib/client.ts`.

## Lancer

```bash
npm install
npm run dev          # http://localhost:3000
```

Pré-requis : le serveur doit tourner (`cd ../server && npm run dev` → :8787, mode mock, sans clé).

## Config

`.env.local` :
- `NEXT_PUBLIC_DYNAMIC_ENV_ID` — Environment ID Dynamic (https://app.dynamic.xyz, gratuit). Vide = le widget s'affiche mais ne connecte pas.
- `NEXT_PUBLIC_API_URL` — URL du serveur (défaut `http://localhost:8787`).

## Ce qui est en place (le squelette)

- **Provider Dynamic** câblé (`app/providers.tsx`) — login wallet sans seed phrase.
- **Client API typé** (`lib/client.ts`) sur le contrat figé (`lib/contract.ts`, copie de `/shared/api.ts`).
- **3 écrans branchés sur le serveur mock** :
  - `/` — onboarding fan (connexion Dynamic + création compte privé)
  - `/creator/[id]` — page de soutien avec **tip à la seconde** (maintenir le bouton)
  - `/dashboard?id=ghost:alice` — total reçu anonyme + retrait

## Ce qu'il TE reste à faire (la vraie valeur)

1. **Design « ghost/dark »** — tout est restylable (classes `gt-*` dans `globals.css`, couleurs `ghost.*` dans `tailwind.config.ts`).
2. **`lib/tip.ts`** — le SEAM. Remplacer la signature MOCK par :
   - signature du message avec le wallet **Dynamic**,
   - **transfert privé via `@unlink-xyz/sdk/browser`** (`createUnlinkClient` + `client.transfer().wait()`).
   C'est ce qui cache réellement le lien fan→créateur.

## Note

`lib/contract.ts` est une **copie** de `/shared/api.ts` (Next ne transpile pas bien hors-dossier). Source de vérité = `/shared/api.ts`. Le contrat est figé, donc pas de drift attendu.
