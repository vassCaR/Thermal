/**
 * Client API typé vers le serveur Ghost Tips (mock par défaut sur :8787).
 * Tous les écrans passent par `api`.
 */
import {
  ENDPOINTS,
  type CreatorBalanceRes,
  type CreatorId,
  type DepositReq,
  type DepositRes,
  type FanAccountId,
  type OnboardReq,
  type OnboardRes,
  type SpentRes,
  type TipAuthorization,
  type TipRes,
  type WithdrawReq,
  type WithdrawRes,
} from "./contract";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

async function post<TReq, TRes>(path: string, body: TReq): Promise<TRes> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<TRes>;
}

async function get<TRes>(path: string): Promise<TRes> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json() as Promise<TRes>;
}

export const api = {
  onboard: (b: OnboardReq) => post<OnboardReq, OnboardRes>(ENDPOINTS.onboard, b),
  deposit: (b: DepositReq) => post<DepositReq, DepositRes>(ENDPOINTS.deposit, b),
  tip: (b: TipAuthorization) => post<TipAuthorization, TipRes>(ENDPOINTS.tip, b),
  meSpent: (fanAccountId: FanAccountId) =>
    get<SpentRes>(`${ENDPOINTS.meSpent}?fanAccountId=${encodeURIComponent(fanAccountId)}`),
  creatorBalance: (id: CreatorId) =>
    get<CreatorBalanceRes>(ENDPOINTS.creatorBalance(id)),
  withdraw: (b: WithdrawReq) => post<WithdrawReq, WithdrawRes>(ENDPOINTS.withdraw, b),
};
