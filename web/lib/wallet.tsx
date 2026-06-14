"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { signTipMock, signTipWithWallet, type TipSignFn } from "./tip";

export const DYNAMIC_ENV_ID = process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID ?? "";
export const DYNAMIC_ENABLED =
  DYNAMIC_ENV_ID.length > 0 && DYNAMIC_ENV_ID !== "REPLACE_WITH_DYNAMIC_ENV_ID";

/** Adresse simulée quand il n'y a pas de clé Dynamic (mode démo). */
export const MOCK_ADDRESS = "0xMOCKfa000000000000000000000000000000abcd";

/**
 * Adresse du wallet courant.
 * - Avec clé Dynamic → vrai wallet connecté.
 * - Sans clé Dynamic → adresse simulée (le mock server accepte tout).
 *
 * DYNAMIC_ENABLED est une constante d'environnement : l'ordre des hooks est
 * stable sur toute la vie du composant, donc l'early-return est sûr au runtime.
 */
export function useWalletAddress(): string {
  if (!DYNAMIC_ENABLED) return MOCK_ADDRESS;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { primaryWallet } = useDynamicContext();
  return primaryWallet?.address ?? MOCK_ADDRESS;
}

export interface TipSigner {
  /** true => each tip is signed by a real connected wallet (EIP-191). */
  real: boolean;
  sign: TipSignFn;
}

/**
 * Returns the tip signer for the current wallet state:
 *   - real EIP-191 signing when a Dynamic wallet is connected,
 *   - mock signature otherwise (demo mode / not connected).
 * DYNAMIC_ENABLED is a build constant so the hook order is stable at runtime.
 */
export function useTipSigner(): TipSigner {
  if (!DYNAMIC_ENABLED) return { real: false, sign: signTipMock };
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { primaryWallet } = useDynamicContext();
  if (primaryWallet && typeof primaryWallet.signMessage === "function") {
    return {
      real: true,
      sign: signTipWithWallet((m) => primaryWallet.signMessage(m)),
    };
  }
  return { real: false, sign: signTipMock };
}
