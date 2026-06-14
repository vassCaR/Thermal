/**
 * Adapter factory — the ONE place that decides mock vs real.
 *
 * Flip MOCK=false in .env to swap both adapters to their real implementations.
 * Nothing else in the codebase imports a concrete adapter directly.
 */
import type { Config } from "../config.js";
import type { CreatorId } from "../contract.js";
import type { CircleSettlementPort } from "../ports/circle.js";
import type { UnlinkAdminPort } from "../ports/unlink.js";
import { MockCircleSettlement } from "./circle.mock.js";
import { RealCircleSettlement } from "./circle.real.js";
import { MockUnlinkAdmin } from "./unlink.mock.js";
import { RealUnlinkAdmin } from "./unlink.real.js";

export interface Adapters {
  unlink: UnlinkAdminPort;
  circle: CircleSettlementPort;
}

/**
 * Creator-only lookup: map an opaque CreatorId to the on-chain 0x address that
 * should receive its settlements, or undefined if none has been registered yet.
 *
 * This is the seam that lets the real settlement adapter resolve a creator's
 * payout address WITHOUT importing the Store (or anything fan-related). The app
 * wires this to Store.getCreatorPayoutAddress. PRIVACY: a CreatorId and its
 * payout address are creator-only data; no fan identity is involved.
 */
export type ResolveCreatorAddress = (
  creatorId: CreatorId,
) => `0x${string}` | undefined;

/**
 * Build the adapters.
 *
 * `resolveCreatorAddress` is OPTIONAL so existing callers (and the mock path)
 * keep working unchanged: the mock settlement adapter does not need a real
 * payout address. It is only threaded into the REAL Circle adapter, which uses
 * it to map creatorId -> payout address at settle time.
 */
export function buildAdapters(
  cfg: Config,
  resolveCreatorAddress?: ResolveCreatorAddress,
): Adapters {
  // Per-service selection: each adapter is mock/real independently so mixed
  // modes work (e.g. real Unlink accounts + mock Circle "tokens"). The real
  // classes only construct/load their SDK when actually selected.
  return {
    unlink: cfg.mockUnlink ? new MockUnlinkAdmin() : new RealUnlinkAdmin(cfg),
    circle: cfg.mockCircle
      ? new MockCircleSettlement()
      : new RealCircleSettlement(cfg, resolveCreatorAddress),
  };
}
