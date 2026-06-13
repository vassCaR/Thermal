/**
 * SEAM — c'est ICI que tu brancheras le cœur du projet.
 *
 * Aujourd'hui : renvoie une signature MOCK acceptée par le serveur en mode mock.
 * À faire (la vraie valeur du hack) :
 *   1. Signer `tipMessageToSign(payload)` avec le wallet Dynamic du fan
 *      (primaryWallet.connector / signMessage).
 *   2. Router le transfert privé via @unlink-xyz/sdk/browser :
 *        const { account } = await account.fromMetaMask({ provider, appId, chainId });
 *        const client = createUnlinkClient({ environment, account });
 *        await client.transfer({ recipientAddress, token, amount }).wait();
 *      => c'est ça qui cache le lien fan→créateur on-chain.
 */
import {
  type TipAuthorization,
  type TipAuthorizationPayload,
  tipMessageToSign,
} from "./contract";

export async function signTip(
  payload: TipAuthorizationPayload,
): Promise<TipAuthorization> {
  const _message = tipMessageToSign(payload);
  // TODO(dynamic+unlink): sign _message with the Dynamic wallet + route the
  // private transfer via @unlink-xyz/sdk/browser.
  // For now: a hex-shaped placeholder (0x + 130 hex chars) so it passes the
  // server's isHex/shape check in mock mode. A plain string like "MOCK_SIGNATURE"
  // is NOT valid hex and gets rejected with 401 "malformed signature".
  const mockSignature = ("0x" + "0".repeat(130)) as `0x${string}`;
  return { ...payload, signature: mockSignature };
}
