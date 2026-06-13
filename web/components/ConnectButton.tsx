"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { DYNAMIC_ENABLED } from "@/lib/wallet";

/** "CONNECT WALLET" CTA. Real Dynamic widget when configured; brutalist demo button otherwise. */
export function ConnectButton() {
  if (!DYNAMIC_ENABLED) {
    return (
      <button
        type="button"
        className="gt-brutal-btn"
        title="Demo mode — wallet simulated. Set NEXT_PUBLIC_DYNAMIC_ENV_ID to enable Dynamic."
      >
        Connect Wallet
        <span className="text-[10px] text-accent">[demo]</span>
      </button>
    );
  }
  return <DynamicWidget />;
}
