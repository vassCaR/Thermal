# DEMO STATUS — Thermal

✅ **DÉMO PRÊTE** — les 4 fixes sont implémentés et testés e2e (browser + curl). Ouvre **http://localhost:3001**.

> Mode MOCK conservé (`MOCK=true`). `.env`, secrets et fonctions gated non touchés.

---

## Ce qui est fixé ET testé OK

| # | Fix | Test e2e | État |
|---|-----|----------|------|
| §1 | **Navbar** : barre élargie, wordmark `THERMAL` à gauche, liens `ABOUT US` / `HOW IT WORKS` agrandis, `CONNECT WALLET` déplacé en haut à droite (flex space-between, responsive) | browser : wordmark + 2 liens + bouton wallet visibles, pas d'overflow | OK |
| §2 | **Branding** : carrés blancs (placeholder `GhostLogo`) supprimés du hero ET de la top bar, wordmark texte seul | browser : `img[alt="Ghost"]` count = **0** | OK |
| §3 | **Support flow réseau** : `Failed to fetch` venait du **back éteint** — le code (`BASE`, `NEXT_PUBLIC_API_URL`, CORS) était déjà correct | curl : `onboard → deposit → tip`, preflight CORS depuis `http://localhost:3001` accepté (`access-control-allow-origin: http://localhost:3001`) | OK |
| §4 | **Mécanique montant** : hold-to-support remplacé par sélecteur de montant (presets `0.10 / 0.50 / 1.00 / 5.00` + champ custom) + bouton `SUPPORT`, état en hooks (plus de localStorage), wording privacy conservé | browser : clic `5.00` → total `5.000000`, custom `2.50` → total `7.500000`, 0 erreur console | OK |

**Test e2e rejouable** : `node ~/ghost-tips/web/scripts/verify-demo.mjs` → doit afficher `RESULT: PASS`.
Backend reproductible :
```bash
FAN=$(curl -s -X POST localhost:8787/api/onboard -H 'Content-Type: application/json' -d '{"dynamicAddress":"0xabc"}' | grep -o 'ghostfan_[a-f0-9]*')
curl -s -X POST localhost:8787/api/deposit -H 'Content-Type: application/json' -d "{\"fanAccountId\":\"$FAN\",\"amount\":\"5.000000\"}"
```

---

## Comment relancer back + front

Les deux tournent dans une session **tmux** nommée `thermal` (survit à la fermeture du terminal).

- **Réattacher** : `tmux attach -t thermal`  (fenêtre `server` = back :8787, fenêtre `web` = front :3001 ; détacher = `Ctrl-b d`)
- **URL à ouvrir** : **http://localhost:3001**

Si la session n'existe plus (`tmux ls` vide), relancer :
```bash
# backend (MOCK, port 8787)
tmux new-session -d -s thermal -n server
tmux send-keys -t thermal:server 'cd ~/ghost-tips/server && npm run dev' C-m

# frontend — PRODUCTION build (port 3001) : léger, ne plante pas en mémoire
tmux new-window -t thermal -n web
tmux send-keys -t thermal:web 'cd ~/ghost-tips/web && npm run start -- -p 3001' C-m
```
Vérifier : `curl localhost:8787/health` → `{"ok":true}` ; `curl -o /dev/null -w "%{http_code}" localhost:3001` → `200`.

Si tu as modifié du code front, **rebuild d'abord** :
```bash
cd ~/ghost-tips/web && NODE_OPTIONS=--max-old-space-size=5120 npm run build
```

---

## ⚠️ Risques de démo restants (+ fix)

1. **Mémoire WSL / `next dev` = OOM.** Cette machine (7,6 Go RAM) tue `next dev` (compilation three.js ~4 Go). **C'est pourquoi le front tourne en `next start` (build de prod, ~300 Mo).**
   → **Ne lance PAS `npm run dev` pour le web** pendant la démo. Reste sur `npm run start`. Évite de lancer un `build` pendant que la démo tourne (le pic mémoire peut tuer le backend par effet de bord).

2. **Verrouillage Windows / mise en veille.** Verrouiller la session Windows **ne tue pas** WSL : tmux survit. **MAIS** si le PC se met en **veille/hibernation**, WSL est gelé (les serveurs se figent et reprennent au réveil). → Avant de verrouiller : **branche le secteur et désactive la mise en veille** (sinon tout est en pause pendant ton absence).

3. **État back en mémoire (mock).** Le store backend est en RAM : si le back redémarre, les totaux repartent à zéro. Le front se réautonomise tout seul (gestion 404/402 → re-onboard + re-fund). → Si le total semble figé, fais simplement un nouveau clic `SUPPORT` ; pas besoin de recharger.

4. **Copie marketing pas alignée (cosmétique, hors scope des 4 fixes).** Les sections sous le hero parlent encore de *« Hold to support »* / *« per-second »* alors que la mécanique est désormais « choix du montant ». Pages `/creator/[id]` et `/dashboard` utilisent aussi l'ancien hold (non touchées — elles marchent). → Si tu scrolles à la caméra, fix rapide possible : `web/components/HomeSections.tsx:114` (étape 02 « Hold to support ») et `:92-94` (cartes « Per-second »). La home (hero + sélecteur) est, elle, 100 % cohérente.

---

## Notes techniques
- Fix annexe nécessaire au build de prod : `web/app/dashboard/page.tsx` — `useSearchParams()` enveloppé dans `<Suspense>` (bug pré-existant qui bloquait `next build`). Aucune logique métier changée.
- Tout est poussé sur GitHub (repo **public**) : https://github.com/vassCaR/ghost-tips — branche `master`.
