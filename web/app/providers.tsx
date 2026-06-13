"use client";

import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DYNAMIC_ENABLED, DYNAMIC_ENV_ID } from "@/lib/wallet";

/**
 * Provider Dynamic — login wallet sans seed phrase.
 * Sans NEXT_PUBLIC_DYNAMIC_ENV_ID → on boote sans le provider (mode démo).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  if (!DYNAMIC_ENABLED) {
    return <>{children}</>;
  }
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {children}
    </DynamicContextProvider>
  );
}
