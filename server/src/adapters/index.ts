/**
 * Adapter factory — the ONE place that decides mock vs real.
 *
 * Flip MOCK=false in .env to swap both adapters to their real implementations.
 * Nothing else in the codebase imports a concrete adapter directly.
 */
import type { Config } from "../config.js";
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

export function buildAdapters(cfg: Config): Adapters {
  if (cfg.mock) {
    return {
      unlink: new MockUnlinkAdmin(),
      circle: new MockCircleSettlement(),
    };
  }
  return {
    unlink: new RealUnlinkAdmin(cfg),
    circle: new RealCircleSettlement(cfg),
  };
}
