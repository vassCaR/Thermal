/**
 * MockUnlinkAdmin — default adapter (MOCK=true).
 *
 * Returns realistic opaque ids and short-lived tokens with no network calls,
 * so the frontend can integrate the full onboarding flow immediately.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type {
  IssueAuthTokenInput,
  IssueAuthTokenResult,
  RegisterFanInput,
  RegisterFanResult,
  UnlinkAdminPort,
} from "../ports/unlink.js";

export class MockUnlinkAdmin implements UnlinkAdminPort {
  readonly kind = "mock" as const;

  async registerFan(_input: RegisterFanInput): Promise<RegisterFanResult> {
    // Opaque, non-reversible id. Looks like a real Unlink private-account handle
    // but is unrelated to the dynamicAddress (privacy: no link is stored here).
    const fanAccountId = `ghostfan_${randomUUID().replace(/-/g, "")}`;
    return { fanAccountId };
  }

  async issueAuthToken(input: IssueAuthTokenInput): Promise<IssueAuthTokenResult> {
    const token = `utok_${randomBytes(24).toString("hex")}`;
    return {
      token,
      expiresAt: Date.now() + 5 * 60_000, // 5 minutes, like a real short-lived token
    };
  }
}
