/**
 * ⚠️ COPIE SYNCHRONISÉE de /shared/api.ts.
 * Next ne transpile pas proprement les fichiers hors du dossier /web, donc on
 * garde une copie locale du contrat. Source de vérité = /shared/api.ts.
 * Si tu changes le contrat, mets à JOUR les deux (mais il est censé être figé).
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
  amount: Usdc;
  nonce: number;
  ts: number;
  signature: string;
}

export type TipAuthorizationPayload = Omit<TipAuthorization, "signature">;

export function tipMessageToSign(p: TipAuthorizationPayload): string {
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
  batched: number;
}

export interface SpentRes {
  total: Usdc;
}

export interface CreatorBalanceRes {
  total: Usdc;
}

export interface WithdrawReq {
  creatorId: CreatorId;
  toAddress: string;
}
export interface WithdrawRes {
  txRef: string;
}

// ---------------------------------------------------------------------------
// Endpoints (chemins figés)
// ---------------------------------------------------------------------------

export const ENDPOINTS = {
  onboard: "/api/onboard",
  deposit: "/api/deposit",
  tip: "/api/tip",
  meSpent: "/api/me/spent",
  creatorBalance: (id: CreatorId) => `/api/creator/${id}/balance`,
  creatorPayout: (id: CreatorId) => `/api/creator/${id}/payout-address`,
  withdraw: "/api/withdraw",
} as const;

// Creator-side admin route (not in the frozen fan-facing contract).
export interface PayoutAddressReq {
  payoutAddress: string;
}
export interface PayoutAddressRes {
  ok: boolean;
  payoutAddress: string;
}
