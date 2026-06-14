"use client";

import { useRef, useState } from "react";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { DYNAMIC_ENABLED } from "@/lib/wallet";
import { WalletModal, type WalletOption } from "@/components/WalletModal";

interface ConnectedWallet {
  id: string;
  name: string;
  logo: string;
  address: string;
}

function randomAddress(): string {
  const hex = "0123456789abcdef";
  let a = "0x";
  for (let i = 0; i < 40; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Compact navbar variant of the brutalist button: smaller padding/type so the
 *  wallet CTA fits the top bar at any width without horizontal overflow. */
const NAV_BTN =
  "inline-flex select-none items-center gap-2 border-2 border-fg bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-wide text-fg outline-none transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:bg-accent hover:text-bg focus-visible:ring-2 focus-visible:ring-accent";

/** "CONNECT WALLET" CTA.
 *  - Real Dynamic widget when NEXT_PUBLIC_DYNAMIC_ENV_ID is configured.
 *  - Otherwise a demo multi-wallet picker (MetaMask / Brave / Rabby / Coinbase /
 *    WalletConnect) that simulates a connection. State is in-memory (no
 *    localStorage), so a reload starts from a clean demo state.
 *  - `compact` renders the smaller navbar variant (used in the top bar). */
export function ConnectButton({ compact = false }: { compact?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const btnClass = compact ? NAV_BTN : "gt-brutal-btn";

  if (DYNAMIC_ENABLED) {
    return <DynamicWidget />;
  }

  function select(w: WalletOption) {
    setConnected({ id: w.id, name: w.name, logo: w.logo, address: randomAddress() });
    setOpen(false);
  }

  function disconnect() {
    setConnected(null);
  }

  if (connected) {
    return (
      <button
        type="button"
        onClick={disconnect}
        data-testid="wallet-connected"
        title={`${connected.name} — click to disconnect`}
        className={`${btnClass} group`}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={connected.logo} alt="" className="h-4 w-4 object-contain" />
        </span>
        <span className="normal-case">{truncate(connected.address)}</span>
        <span className="text-[10px] text-accent group-hover:text-bg">[demo]</span>
      </button>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid="connect-wallet"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={btnClass}
      >
        Connect Wallet
        <span className="text-[10px] text-accent">[demo]</span>
      </button>
      <WalletModal
        open={open}
        onClose={() => setOpen(false)}
        onSelect={select}
        anchorRef={triggerRef}
      />
    </>
  );
}
