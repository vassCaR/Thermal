"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";

export type WalletId = "metamask" | "brave" | "rabby" | "coinbase" | "walletconnect";

export interface WalletOption {
  id: WalletId;
  name: string;
  tag: string;
  color: string;
  glyph: React.ReactNode;
}

/** Compact brand-colored square marks (brutalist, square corners). */
const G = (node: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
    {node}
  </svg>
);

export const WALLETS: WalletOption[] = [
  {
    id: "metamask",
    name: "MetaMask",
    tag: "Browser extension",
    color: "#E2761B",
    glyph: G(
      <path
        d="M12 3 5 7l1.6 4L4 13l2 4 3.2-1.2L12 18l2.8-2.2L18 17l2-4-2.6-2L19 7l-7-4Zm0 0v6"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />,
    ),
  },
  {
    id: "brave",
    name: "Brave Wallet",
    tag: "Built into Brave",
    color: "#FB542B",
    glyph: G(<path d="M12 3l6 2 1 4-1 7-6 5-6-5-1-7 1-4 6-2Z" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />),
  },
  {
    id: "rabby",
    name: "Rabby Wallet",
    tag: "Browser extension",
    color: "#7084FF",
    glyph: G(
      <>
        <path d="M9 4v5M13 4v5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M4 14a7 5 0 0 1 14 0v3a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-3Z" fill="none" stroke="#fff" strokeWidth="1.6" />
      </>,
    ),
  },
  {
    id: "coinbase",
    name: "Coinbase Wallet",
    tag: "Mobile & extension",
    color: "#0052FF",
    glyph: G(
      <>
        <circle cx="12" cy="12" r="8" fill="none" stroke="#fff" strokeWidth="1.6" />
        <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="#fff" />
      </>,
    ),
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    tag: "Scan with any wallet",
    color: "#3B99FC",
    glyph: G(
      <path
        d="M6.5 10.5a7 7 0 0 1 11 0M9 13a3.5 3.5 0 0 1 6 0"
        fill="none"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />,
    ),
  },
];

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
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center"
                    style={{ backgroundColor: w.color }}
                  >
                    {w.glyph}
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
