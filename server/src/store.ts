/**
 * In-memory state. Resets on restart — fine for a hackathon demo.
 *
 * PRIVACY NOTE: we deliberately do NOT store any fan->creator mapping. The fan
 * record tracks only the fan's own balance/spend/nonce. The creator record
 * tracks only an anonymous accrued total and a count of settlements. There is
 * no table that says "fan X supports creator Y".
 */
import type { CreatorId, FanAccountId, Usdc } from "./contract.js";
import { ZERO_USDC } from "./usdc.js";

export interface FanState {
  fanAccountId: FanAccountId;
  /** Deposited-and-available balance (private to the fan). */
  balance: Usdc;
  /** Lifetime total the fan has tipped (private to the fan). */
  spent: Usdc;
  /** Highest accepted nonce; the next tip must be strictly greater (anti-replay). */
  lastNonce: number;
}

export interface CreatorState {
  creatorId: CreatorId;
  /** Anonymous accrued total available to withdraw. NO fan identities. */
  accrued: Usdc;
  /** How many settlement batches have landed (for the demo, not sensitive). */
  settlements: number;
  /**
   * The creator's on-chain payout address (a 0x EVM address) where batched
   * settlements should land. CREATOR-ONLY data — this is the public address the
   * creator chooses to be paid at. It is NOT a fan identity and never derives
   * from one. Optional because a creator may exist (and accrue) before they have
   * registered a payout address; the real settlement adapter only needs it at
   * settle time. The CreatorId itself stays an opaque handle (e.g. "ghost:alice")
   * and is intentionally decoupled from this address.
   */
  payoutAddress?: `0x${string}`;
}

export class Store {
  private fans = new Map<FanAccountId, FanState>();
  private creators = new Map<CreatorId, CreatorState>();

  createFan(fanAccountId: FanAccountId): FanState {
    const fan: FanState = {
      fanAccountId,
      balance: ZERO_USDC,
      spent: ZERO_USDC,
      lastNonce: 0,
    };
    this.fans.set(fanAccountId, fan);
    return fan;
  }

  getFan(fanAccountId: FanAccountId): FanState | undefined {
    return this.fans.get(fanAccountId);
  }

  /** Get a creator, lazily creating an empty anonymous record on first sight. */
  getOrCreateCreator(creatorId: CreatorId): CreatorState {
    let c = this.creators.get(creatorId);
    if (!c) {
      c = { creatorId, accrued: ZERO_USDC, settlements: 0 };
      this.creators.set(creatorId, c);
    }
    return c;
  }

  getCreator(creatorId: CreatorId): CreatorState | undefined {
    return this.creators.get(creatorId);
  }

  /**
   * Register/overwrite a creator's on-chain payout address.
   *
   * Creator-only operation: it associates an opaque CreatorId handle with the
   * public 0x address the creator wants settlements paid to. No fan data is read,
   * stored, or derived here — this is purely the creator's own payout target.
   * Lazily creates the anonymous creator record if it doesn't exist yet.
   */
  setCreatorPayoutAddress(creatorId: CreatorId, payoutAddress: `0x${string}`): void {
    const creator = this.getOrCreateCreator(creatorId);
    creator.payoutAddress = payoutAddress;
  }

  /**
   * Resolve a CreatorId to its registered payout address, or undefined if none
   * has been registered. This is the getter the settlement adapter is threaded
   * with (via buildAdapters) so it can map creatorId -> on-chain address WITHOUT
   * the adapter needing a reference to the whole Store. Creator-only; no fan data.
   */
  getCreatorPayoutAddress(creatorId: CreatorId): `0x${string}` | undefined {
    return this.creators.get(creatorId)?.payoutAddress;
  }
}
