"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

export type WalletId = "metamask" | "brave" | "rabby" | "coinbase" | "walletconnect";

export interface WalletOption {
  id: WalletId;
  name: string;
  tag: string;
  logo: string;
}

export const WALLETS: WalletOption[] = [
  { id: "metamask", name: "MetaMask", tag: "Browser extension", logo: "/wallets/metamask.svg" },
  { id: "brave", name: "Brave Wallet", tag: "Built into Brave", logo: "/wallets/brave.svg" },
  { id: "rabby", name: "Rabby Wallet", tag: "Browser extension", logo: "/wallets/rabby.svg" },
  { id: "coinbase", name: "Coinbase Wallet", tag: "Mobile & extension", logo: "/wallets/coinbase.svg" },
  { id: "walletconnect", name: "WalletConnect", tag: "Scan with any wallet", logo: "/wallets/walletconnect.svg" },
];

function WalletLogo({ src, className }: { src: string; className: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} />;
}

export function WalletModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (w: WalletOption) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <motion.div
            role="dialog"
            aria-label="Connect a wallet"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative w-full max-w-md border border-border bg-bg p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-black uppercase text-fg">
                Connect a wallet
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="font-mono text-xs uppercase text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              {WALLETS.map((w) => (
                <button
                  key={w.id}
                  data-testid={`wallet-${w.id}`}
                  onClick={() => onSelect(w)}
                  className="group flex w-full items-center gap-4 border border-border bg-black/40 px-4 py-3 text-left outline-none transition-colors duration-150 hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-white/5">
                    <WalletLogo src={w.logo} className="h-6 w-6 object-contain" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-mono text-sm uppercase tracking-wide text-fg">
                      {w.name}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wide text-muted">
                      {w.tag}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="ml-auto font-mono text-muted transition-colors group-hover:text-accent"
                  >
                    &rarr;
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-5 font-mono text-[11px] leading-relaxed text-muted">
              Demo mode — wallets are simulated. Set NEXT_PUBLIC_DYNAMIC_ENV_ID to
              enable real wallet connections via Dynamic.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
