# DEMO STATUS — Thermal

✅ **DÉMO PRÊTE** — V2 livrée et testée e2e (browser + curl) : dropdown wallet corrigé, top bar enrichie, bouton DEMO scripté, pattern adapter + plan de migration réel documentés. Ouvre **http://localhost:3001**.

> Mode MOCK conservé (`MOCK=true`). `.env`, secrets et fonctions gated (`submitGatewaySettlement`, `registerFan`) **non touchés** — la préparation du réel est de la doc + du code derrière le flag.

---

## V2 — ce qui est fait ET testé OK

| # | Objectif | Test e2e | État |
|---|----------|----------|------|
| §1 | **Dropdown wallet** : popover ancré **sous** le bouton (ouvre vers le bas, aligné à droite), height-cappé + scrollable, z-index au-dessus de la hero/WebGL, clavier (flèches/Escape), `:focus-visible` | browser (viewport court 560px) : menu sous le trigger (`menu.y ≥ trigger.bottom`), pas de clip en haut, tient dans le viewport, 5 wallets atteignables, sélection → connecté | OK |
| §2 | **Top bar enrichie** : lien **Docs** (→ repo GitHub public, pas de 404) + badge **Arc Testnet** (statut réseau discret, point pulsé) | browser : Docs `href` = github.com, badge visible, **0 overflow-x** | OK |
| §3 | **Bouton DEMO** : badge `DEMO MODE — SIMULATED` + bouton `▶ RUN DEMO` distinct, scénario scripté (wallet→montant→support→settlement→total) réutilisant `supportOnce()` (pas de duplication de logique) | browser : Run Demo → `DEMO COMPLETE`, total 0→6.000000, **rejouable** (→12.000000), 0 erreur réseau/console | OK |
| §4 | **Pattern adapter renforcé + plan de migration réel** (doc, sans rien brancher) | typecheck OK, MOCK intact | OK (voir §4 ci-dessous) |
| — | **Non-régression** flux support manuel | browser : `5.00` → Support → total monte (12→17) | OK |

**Tests rejouables** :
- Front : `node ~/ghost-tips/web/scripts/verify-demo.mjs` → `RESULT: PASS`
- Back :
```bash
FAN=$(curl -s -X POST localhost:8787/api/onboard -H 'Content-Type: application/json' -d '{"dynamicAddress":"0xabc"}' | grep -o 'ghostfan_[a-f0-9]*')
curl -s -X POST localhost:8787/api/deposit -H 'Content-Type: application/json' -d "{\"fanAccountId\":\"$FAN\",\"amount\":\"5.000000\"}"
```

---

## §2 — éléments ajoutés à la top bar (+ justification)

- **Lien `Docs`** (gauche, → https://github.com/vassCaR/ghost-tips) — donne aux juges une destination réelle pour lire le modèle de privacy ; aucune page morte (le repo est public).
- **Badge `Arc Testnet`** (droite, près du wallet) — signale honnêtement le réseau de settlement (Circle Arc, testnet), cohérent avec un produit de paiement privacy et avec `CHAIN_ENV=arc-testnet`.
- Écartés volontairement (pour ne pas surcharger) : annuaire « Creators » (pas de page liste existante → risque de 404), compteur global « supported » (redondant avec le compteur du hero, source de confusion).

## §3 — fonctionnement du bouton DEMO

- `Run Demo` déroule un happy-path scripté : ① wallet connecté (simulé) → ② sélection 1.00 puis 5.00 USDC → ③ envoi du support privé (vrai appel MOCK `onboard→deposit→tip`) → ④ « Settled on Arc — simulated » → total mis à jour en direct. Replayable à l'infini.
- **Honnêteté juges** : badge permanent `DEMO MODE — SIMULATED` + chaque étape libellée « simulated » + `[DEMO]` sur le wallet. Aucune prétention on-chain.
- **Pas de duplication** : `runDemo` et le bouton `Support` manuel appellent le même cœur `supportOnce(value)` (branché sur les adaptateurs MOCK). L'interaction manuelle reste possible à tout moment.

---

## §4 — Pattern adapter + plan de bascule vers le RÉEL (rien branché)

### Pattern (confirmé, solide)
Un **seul point de décision** : `server/src/adapters/index.ts` → `buildAdapters(cfg)` choisit mock vs real selon `cfg.mock` (issu de `MOCK`). Rien d'autre n'importe un adaptateur concret.

| Service | Port (interface) | Impl. mock | Impl. real |
|---------|------------------|-----------|-----------|
| Unlink (privacy accounts) | `ports/unlink.ts` `UnlinkAdminPort` (`registerFan`, `issueAuthToken`) | `unlink.mock.ts` | `unlink.real.ts` |
| Circle (settlement Arc) | `ports/circle.ts` `CircleSettlementPort` (`settleBatch`, `withdraw`) | `circle.mock.ts` | `circle.real.ts` |
| Wallet (front) | `lib/wallet.tsx` (`DYNAMIC_ENABLED`) | adresse MOCK | Dynamic réel si `NEXT_PUBLIC_DYNAMIC_ENV_ID` |

`assertRealConfig()` (config.ts) **fail-fast** si `MOCK=false` sans les clés requises → impossible de démarrer le réel à moitié configuré.

### Ce qui reste à faire pour le RÉEL (priorisé, à activer APRÈS la démo)
1. **Wallet réel (front, indépendant de MOCK, faible risque)** : poser `NEXT_PUBLIC_DYNAMIC_ENV_ID` dans `web/.env.local` → remplace le picker démo par Dynamic. Testable seul.
2. **Config serveur** : créer `.env` (`MOCK=false`) avec les valeurs **testnet confirmées** (déjà documentées dans `circle.real.ts` : `ARC_RPC_URL`, `USDC_ADDRESS=0x3600…0000`, `CIRCLE_GATEWAY_URL=https://gateway-api-testnet.circle.com`) + secrets. `assertRealConfig` liste les manquants.
3. **Unlink `registerFan` (GATED, throw aujourd'hui)** : étendre `UnlinkAdminPort.registerFan` pour porter le `RegistrationPayloadWire` dérivé **côté client**, puis relais admin `admin.users.register(...)`. → besoin de la **vraie `UNLINK_API_KEY` + `UNLINK_ENGINE_URL`** et confirmer le format avec Unlink DevRel (`UNLINK_ENV="arc-testnet"` confirmé dans `unlink.real.ts`).
4. **Transfert privé client (le cœur)** : implémenter le vrai chemin dans `web/lib/tip.ts` (aujourd'hui signature MOCK) : `Dynamic.signMessage(tipMessageToSign)` + `@unlink-xyz/sdk/browser` `client.transfer(...)`. C'est ce qui cache le lien fan→créateur on-chain.
5. **Circle settlement (GATED)** : `submitGatewaySettlement()` throw tant que la route/auth Gateway batch-settle n'est pas confirmée → soit intégrer `@circle-fin/x402-batching` (`BatchFacilitatorClient.settle`), soit activer le `fetch()` REST une fois le path/auth validés avec Circle DevRel. Puis tester `settleBatch` sur Arc testnet.
6. **Withdraw réel** : déjà implémenté (viem, settler **déjà financé** en testnet) — vérifier la registry payout-address créateur + `withdraw()` sur testnet.
7. **À chaque étape : tester les DEUX modes** (régression MOCK + réel).

### Ce qu'il te reste à fournir
- `UNLINK_API_KEY` (+ `UNLINK_ENGINE_URL`) réelle, format confirmé Unlink DevRel.
- Confirmation Circle DevRel : route + auth exactes du Gateway batch-settle.
- `NEXT_PUBLIC_DYNAMIC_ENV_ID` pour les wallets réels.
- (`SETTLER_PRIVATE_KEY` settler déjà financé testnet — à confirmer.)

---

## Relancer back + front

Session **tmux** `thermal` (survit à la fermeture du terminal). **URL : http://localhost:3001**.
- Réattacher : `tmux attach -t thermal` (fenêtre `server` :8787, fenêtre `web` :3001 ; détacher = `Ctrl-b d`).
- Si `tmux ls` est vide, relancer :
```bash
tmux new-session -d -s thermal -n server
tmux send-keys -t thermal:server 'cd ~/ghost-tips/server && npm run dev' C-m
tmux new-window -t thermal -n web
tmux send-keys -t thermal:web 'cd ~/ghost-tips/web && npm run start -- -p 3001' C-m
```
Vérifs : `curl localhost:8787/health` → `{"ok":true}` ; `curl -o /dev/null -w "%{http_code}" localhost:3001` → `200`.

**Si tu modifies du code front, rebuild AVANT `npm run start`** :
```bash
cd ~/ghost-tips/web && NODE_OPTIONS=--max-old-space-size=5120 npm run build
```

---

## ⚠️ Risques de démo restants (+ fix)

1. **Mémoire WSL / `next dev` = OOM.** Machine 7,6 Go RAM ; `next dev` (compilation three.js ~4 Go) se fait tuer (OOM killer — il a déjà tué le backend par effet de bord). **Le front tourne donc en `next start` (build de prod, ~300 Mo).** → **Ne lance pas `npm run dev` pour le web** et évite un `build` pendant que la démo tourne (pic mémoire). Build d'abord, démo ensuite.
2. **Verrouillage Windows / veille.** Verrouiller ne tue pas WSL (tmux survit). **Mais** veille/hibernation **gèle** WSL. → Avant de verrouiller : **secteur branché + veille désactivée**.
3. **État back en mémoire (mock).** Le store backend est en RAM : un redémarrage du back remet les totaux à zéro. Le front se réautonomise (404/402 → re-onboard + re-fund). → Si le total semble figé, refais un `Support` ou `Run Demo` ; pas besoin de recharger.
4. **Copie marketing (cosmétique, hors scope).** Sections sous le hero / pages `/creator/[id]` et `/dashboard` parlent encore de *« Hold to support »* / *« per-second »* (mécanique historique). La home (hero + sélecteur + DEMO) est, elle, 100 % cohérente. → Fix optionnel : `web/components/HomeSections.tsx:114` et `:92-94`.

---

## Notes
- Fix annexe build de prod : `web/app/dashboard/page.tsx` — `useSearchParams()` sous `<Suspense>` (bug pré-existant qui bloquait `next build`). Aucune logique métier changée.
- `ConnectButton`/`CtaButtons` : état en hooks (plus de `localStorage`, conforme §5).
- Repo **public** : https://github.com/vassCaR/ghost-tips — branche `master`.
