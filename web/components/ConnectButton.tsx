"use client";

import { useEffect, useState } from "react";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { DYNAMIC_ENABLED } from "@/lib/wallet";
import { WalletModal, WALLETS, type WalletOption } from "@/components/WalletModal";

interface ConnectedWallet {
  id: string;
  name: string;
  color: string;
  address: string;
}

const STORAGE_KEY = "gt_wallet";

function randomAddress(): string {
  const hex = "0123456789abcdef";
  let a = "0x";
  for (let i = 0; i < 40; i++) a += hex[Math.floor(Math.random() * 16)];
  return a;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** "CONNECT WALLET" CTA.
 *  - Real Dynamic widget when NEXT_PUBLIC_DYNAMIC_ENV_ID is configured.
 *  - Otherwise a demo multi-wallet picker (MetaMask / Brave / Rabby / Coinbase /
 *    WalletConnect) that simulates a connection. */
export function ConnectButton() {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setConnected(JSON.parse(raw) as ConnectedWallet);
    } catch {
      /* ignore */
    }
  }, []);

  if (DYNAMIC_ENABLED) {
    return <DynamicWidget />;
  }

  function select(w: WalletOption) {
    const wallet: ConnectedWallet = {
      id: w.id,
      name: w.name,
      color: w.color,
      address: randomAddress(),
    };
    setConnected(wallet);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet));
    setOpen(false);
  }

  function disconnect() {
    setConnected(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  if (connected) {
    const w = WALLETS.find((x) => x.id === connected.id);
    return (
      <button
        type="button"
        onClick={disconnect}
        data-testid="wallet-connected"
        title={`${connected.name} — click to disconnect`}
        className="gt-brutal-btn group"
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center"
          style={{ backgroundColor: connected.color }}
        >
          {w?.glyph}
        </span>
        <span className="normal-case">{truncate(connected.address)}</span>
        <span className="text-[10px] text-accent group-hover:text-bg">[demo]</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        data-testid="connect-wallet"
        onClick={() => setOpen(true)}
        className="gt-brutal-btn"
      >
        Connect Wallet
        <span className="text-[10px] text-accent">[demo]</span>
      </button>
      <WalletModal open={open} onClose={() => setOpen(false)} onSelect={select} />
    </>
  );
}
