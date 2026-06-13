"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

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
