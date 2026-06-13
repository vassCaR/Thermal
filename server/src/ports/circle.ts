/**
 * CircleSettlementPort — the server's seam onto Circle Nanopayments on Arc.
 *
 * Pattern mirrored from circlefin/arc-nanopayments (Circle Nanopayments powered
 * by Circle Gateway): many off-chain signed authorizations are aggregated and
 * settled in near-instant, gas-free, sub-cent USDC transactions on Arc.
 *
 * The server's batcher accumulates per-creator authorizations and hands a batch
 * to this port. The port returns a settlement reference (a txRef on Arc, or a
 * Gateway settlement id) that the creator can later cite when withdrawing.
 *
 * Swap MockCircleSettlement -> RealCircleSettlement by setting MOCK=false.
 */
import type { CreatorId, Usdc } from "../contract.js";

/**
 * One verified authorization ready to settle.
 * PRIVACY: deliberately carries NO fanAccountId — the settlement is to the
 * creator only, so the fan->creator link never reaches the settlement layer.
 */
export interface SettlementItem {
  creatorId: CreatorId;
  amount: Usdc;
  nonce: number;
  ts: number;
}

export interface SettleBatchInput {
  creatorId: CreatorId;
  /** The verified authorizations to aggregate into one settlement. */
  items: SettlementItem[];
  /** Sum of item amounts (pre-computed by the batcher for convenience). */
  total: Usdc;
}

export interface SettleBatchResult {
  /** On-chain / Gateway settlement reference. Anonymous: no fan identities. */
  txRef: string;
  settledTotal: Usdc;
  itemCount: number;
}

export interface WithdrawInput {
  creatorId: CreatorId;
  toAddress: string;
  amount: Usdc;
}

export interface WithdrawResult {
  txRef: string;
}

export interface CircleSettlementPort {
  readonly kind: "mock" | "real";
  /** Settle one aggregated per-creator batch. Returns an anonymous txRef. */
  settleBatch(input: SettleBatchInput): Promise<SettleBatchResult>;
  /** Pay out a creator's accrued anonymous balance to a public address. */
  withdraw(input: WithdrawInput): Promise<WithdrawResult>;
}
