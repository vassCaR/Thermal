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
}
