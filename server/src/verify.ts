/**
 * Tip authorization verification.
 *
 * The fan signs the deterministic string from the shared contract's
 * tipMessageToSign(payload) with their Dynamic wallet (EIP-191 personal_sign).
 *
 * Modes:
 *   - MOCK (default): we cannot map a fanAccountId -> on-chain address (that link
 *     is intentionally private and not stored), so we only require that a
 *     signature string is PRESENT and well-formed. This matches the task brief.
 *   - REAL: if the frontend additionally provides the signer address out-of-band
 *     (e.g. captured at onboard time), recoverMessageAddress can be enforced.
 *     The hook is here via verifyAgainstAddress().
 */
import { isHex, recoverMessageAddress } from "viem";
import { tipMessageToSign, type TipAuthorization } from "./contract.js";

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

/** Presence/shape check used in mock mode (and as a fast pre-filter in real). */
export function verifyPresence(auth: TipAuthorization): VerifyResult {
  if (typeof auth.signature !== "string" || auth.signature.length === 0) {
    return { ok: false, reason: "missing signature" };
  }
  // A real EIP-191 sig is 0x + 130 hex chars; be lenient but sane.
  if (!isHex(auth.signature) || auth.signature.length < 4) {
    return { ok: false, reason: "malformed signature" };
  }
  return { ok: true };
}

/**
 * Full cryptographic check: recover the signer from the canonical message and
 * compare to an expected address. Used only when we actually know the address.
 */
export async function verifyAgainstAddress(
  auth: TipAuthorization,
  expectedAddress: string,
): Promise<VerifyResult> {
  const presence = verifyPresence(auth);
  if (!presence.ok) return presence;
  try {
    const message = tipMessageToSign({
      fanAccountId: auth.fanAccountId,
      creatorId: auth.creatorId,
      amount: auth.amount,
      nonce: auth.nonce,
      ts: auth.ts,
    });
    const recovered = await recoverMessageAddress({
      message,
      signature: auth.signature as `0x${string}`,
    });
    if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
      return { ok: false, reason: "signature does not match expected address" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "signature recovery failed" };
  }
}
