"use client";

import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { MotionConfig } from "motion/react";
import { DYNAMIC_ENABLED, DYNAMIC_ENV_ID } from "@/lib/wallet";

/**
 * App providers.
 * - MotionConfig reducedMotion="user" → all motion respects prefers-reduced-motion.
 * - Dynamic wallet provider when NEXT_PUBLIC_DYNAMIC_ENV_ID is set; otherwise the
 *   app boots in demo mode (simulated wallet) without the provider.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const inner = DYNAMIC_ENABLED ? (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      {children}
    </DynamicContextProvider>
  ) : (
    <>{children}</>
  );

  return <MotionConfig reducedMotion="user">{inner}</MotionConfig>;
}
