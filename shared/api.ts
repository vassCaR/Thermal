/**
 * Ghost Tips — contrat d'API partagé (FIGÉ à l'heure 0).
 *
 * Les deux devs importent ce fichier. Personne ne change une signature sans
 * prévenir l'autre. C'est le SEUL point de contact entre /server et /web.
 *
 * Track : Best Private Nano Payment App (Dynamic + Unlink + Arc).
 */

// ---------------------------------------------------------------------------
// Types de base
// ---------------------------------------------------------------------------

/** Montant USDC en string, 6 décimales (ex: "0.002000"). Jamais de float. */
export type Usdc = string;

/** Handle public d'un créateur (ex: "ghost:alice"). Pas une adresse. */
export type CreatorId = string;

/** Id opaque du compte privé Unlink d'un fan. Ne révèle jamais l'adresse réelle. */
export type FanAccountId = string;

// ---------------------------------------------------------------------------
// Autorisation de tip — signée par le wallet Dynamic du fan, ~1x/seconde
// ---------------------------------------------------------------------------

export interface TipAuthorization {
  fanAccountId: FanAccountId;
  creatorId: CreatorId;
  amount: Usdc; // micro-montant du tick (ex: "0.002000")
  nonce: number; // incrément par fan, anti-replay
  ts: number; // Date.now()
  signature: string; // signée par le wallet Dynamic du fan
}

/** Le payload (sans la signature) que le fan signe. JSON.stringify déterministe. */
export type TipAuthorizationPayload = Omit<TipAuthorization, "signature">;

export function tipMessageToSign(p: TipAuthorizationPayload): string {
  // Ordre des clés FIGÉ — les deux côtés doivent produire la même string.
  return JSON.stringify({
    fanAccountId: p.fanAccountId,
    creatorId: p.creatorId,
    amount: p.amount,
    nonce: p.nonce,
    ts: p.ts,
  });
}

// ---------------------------------------------------------------------------
// Requêtes / réponses
// ---------------------------------------------------------------------------

export interface OnboardReq {
  dynamicAddress: string;
}
export interface OnboardRes {
  fanAccountId: FanAccountId;
}

export interface DepositReq {
  fanAccountId: FanAccountId;
  amount: Usdc;
}
export interface DepositRes {
  ok: boolean;
  balance: Usdc;
}

export interface TipRes {
  accepted: boolean;
  batched: number; // nb de ticks actuellement dans le batch en attente
}

export interface SpentRes {
  total: Usdc; // visible par le fan seul
}

export interface CreatorBalanceRes {
  total: Usdc; // total accumulé, ANONYME (aucune liste de fans)
}

export interface WithdrawReq {
  creatorId: CreatorId;
  toAddress: string;
}
export interface WithdrawRes {
  txRef: string; // référence de règlement Arc
}

// ---------------------------------------------------------------------------
// Endpoints (chemins figés)
// ---------------------------------------------------------------------------

export const ENDPOINTS = {
  onboard: "/api/onboard", // POST  OnboardReq        -> OnboardRes
  deposit: "/api/deposit", // POST  DepositReq        -> DepositRes
  tip: "/api/tip", // POST  TipAuthorization -> TipRes
  meSpent: "/api/me/spent", // GET   ?fanAccountId=    -> SpentRes
  creatorBalance: (id: CreatorId) => `/api/creator/${id}/balance`, // GET -> CreatorBalanceRes
  withdraw: "/api/withdraw", // POST  WithdrawReq       -> WithdrawRes
} as const;

// ---------------------------------------------------------------------------
// Petit helper fetch typé (optionnel, utilisable côté /web)
// ---------------------------------------------------------------------------

export async function apiPost<TReq, TRes>(
  baseUrl: string,
  path: string,
  body: TReq,
): Promise<TRes> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<TRes>;
}

export async function apiGet<TRes>(baseUrl: string, path: string): Promise<TRes> {
  const res = await fetch(`${baseUrl}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<TRes>;
}
