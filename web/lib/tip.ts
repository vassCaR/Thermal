/**
 * Tip authorization signing.
 *
 * Two signers, same shape:
 *   - signTipMock: a hex-shaped placeholder accepted by the server in MOCK mode
 *     (used for the scripted demo and when no real wallet is connected).
 *   - signTipWithWallet: a REAL EIP-191 personal_sign of tipMessageToSign(payload)
 *     using the connected Dynamic wallet. The signature is genuinely produced by
 *     the user's wallet; the MOCK server checks presence/shape only because it
 *     deliberately never stores the fan's real address (privacy invariant).
 *
 * Only the USDC value movement (settlement on Arc) stays simulated — the wallet
 * and the authorization signature are real when a wallet is connected.
 */
import {
  type TipAuthorization,
  type TipAuthorizationPayload,
  tipMessageToSign,
} from "./contract";

/** Signer function shape shared by mock + real. */
export type TipSignFn = (
  payload: TipAuthorizationPayload,
) => Promise<TipAuthorization>;

/** MOCK signer: 0x + 130 hex chars so it passes the server's isHex/shape check. */
export const signTipMock: TipSignFn = async (payload) => {
  const mockSignature = ("0x" + "0".repeat(130)) as `0x${string}`;
  return { ...payload, signature: mockSignature };
};

/** Back-compat alias (older imports). */
export const signTip = signTipMock;

/**
 * REAL signer: signs the canonical tip message with the connected wallet.
 * `signMessage` is the Dynamic wallet's personal_sign (primaryWallet.signMessage).
 * Throws if the wallet rejects or returns nothing, so callers can surface it.
 */
export function signTipWithWallet(
  signMessage: (message: string) => Promise<string | undefined>,
): TipSignFn {
  return async (payload) => {
    const message = tipMessageToSign(payload);
    const signature = await signMessage(message);
    if (!signature || !signature.startsWith("0x")) {
      throw new Error("wallet signature failed or was rejected");
    }
    return { ...payload, signature: signature as `0x${string}` };
  };
}
