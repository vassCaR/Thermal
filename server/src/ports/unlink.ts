/**
 * UnlinkAdminPort — the server's seam onto the Unlink ADMIN SDK.
 *
 * Privacy model (document this, it is the heart of the prize):
 *   - PRIVATE: balances, amounts, and transaction history inside the shielded
 *     pool, AND the fan->creator support relationship.
 *   - PUBLIC: deposits into and withdrawals out of the shielded pool are visible
 *     on-chain (entering/exiting the pool is observable; who-pays-whom is not).
 *
 * Server responsibilities (admin side only — the PRIVATE per-second transfer is
 * done CLIENT-SIDE by the /web dev with @unlink-xyz/sdk/browser + Dynamic):
 *   1. registerFan()   -> register a private account, return an opaque id.
 *   2. issueAuthToken() -> mint a short-lived authorization token the frontend
 *      needs to perform a private transfer on the fan's behalf.
 *
 * Swap MockUnlinkAdmin -> RealUnlinkAdmin by setting MOCK=false (see config).
 */

export interface RegisterFanInput {
  /** The fan's Dynamic embedded-wallet address. */
  dynamicAddress: string;
}

export interface RegisterFanResult {
  /** Opaque private-account id. MUST NOT reveal the real address. */
  fanAccountId: string;
}

export interface IssueAuthTokenInput {
  fanAccountId: string;
  /** Optional scope/creator hint; never persisted in a way that links fan->creator. */
  creatorId?: string;
}

export interface IssueAuthTokenResult {
  token: string;
  expiresAt: number; // epoch ms
}

export interface UnlinkAdminPort {
  readonly kind: "mock" | "real";
  /** Register a fan's private Unlink account; returns an opaque account id. */
  registerFan(input: RegisterFanInput): Promise<RegisterFanResult>;
  /** Issue an authorization token the frontend uses to do a private transfer. */
  issueAuthToken(input: IssueAuthTokenInput): Promise<IssueAuthTokenResult>;
}
