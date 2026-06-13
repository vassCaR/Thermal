"use client";

import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { DYNAMIC_ENABLED } from "@/lib/wallet";

export function ConnectButton() {
  if (!DYNAMIC_ENABLED) {
    return (
      <span className="text-xs text-ghost-muted">
        Mode démo · wallet simulé — ajoute <code>NEXT_PUBLIC_DYNAMIC_ENV_ID</code> dans
        <code> .env.local</code> pour activer Dynamic.
      </span>
    );
  }
  return <DynamicWidget />;
}
