"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { DYNAMIC_ENABLED } from "@/lib/wallet";

/** "Connect Wallet" control. Real Dynamic widget when configured; a labelled demo pill otherwise. */
export function ConnectButton() {
  if (!DYNAMIC_ENABLED) {
    return (
      <span
        title="Demo mode — wallet simulated. Set NEXT_PUBLIC_DYNAMIC_ENV_ID to enable Dynamic."
        className="inline-flex items-center gap-2 rounded-xl border border-ghost-border bg-white/5 px-4 py-2 text-sm font-medium text-white"
      >
        Connect Wallet
        <span className="rounded bg-ghost-accent/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ghost-accent2">
          demo
        </span>
      </span>
    );
  }
  return <DynamicWidget />;
}
