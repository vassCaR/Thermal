"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

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

interface Coords {
  top: number;
  right: number;
  maxHeight: number;
}

/** Compute a downward, right-aligned anchor under the trigger, clamped so the
 *  menu never overflows the viewport (it scrolls internally instead). */
function computeCoords(el: HTMLElement): Coords {
  const r = el.getBoundingClientRect();
  const GAP = 8;
  const MARGIN = 16;
  return {
    top: r.bottom + GAP,
    right: Math.max(MARGIN, window.innerWidth - r.right),
    maxHeight: Math.max(160, window.innerHeight - r.bottom - GAP - MARGIN),
  };
}

/** Wallet picker rendered as a popover anchored BELOW the trigger button
 *  (opens downward, right-aligned). Height-capped + scrollable so every wallet
 *  stays reachable on short viewports; sits above the hero/WebGL canvas. */
export function WalletModal({
  open,
  onClose,
  onSelect,
  anchorRef,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (w: WalletOption) => void;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const reposition = useCallback(() => {
    if (anchorRef.current) setCoords(computeCoords(anchorRef.current));
  }, [anchorRef]);

  // Position on open and keep it anchored on resize/scroll.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      anchorRef.current?.focus();
      return;
    }
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[];
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1 + items.length) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Transparent backdrop catches outside clicks without dimming the hero. */}
          <div className="fixed inset-0 z-[110]" onClick={onClose} aria-hidden />
          <motion.div
            role="menu"
            aria-label="Connect a wallet"
            onKeyDown={onKeyDown}
            initial={{ y: -6, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -6, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{
              top: coords?.top ?? -9999,
              right: coords?.right ?? 16,
              maxHeight: coords?.maxHeight,
              transformOrigin: "top right",
            }}
            className="fixed z-[120] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col border border-border bg-bg shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-display text-sm font-black uppercase tracking-wide text-fg">
                Connect a wallet
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="font-mono text-[clamp(0.66rem,0.6rem+0.25vw,0.72rem)] uppercase text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
              >
                Esc
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto p-3">
              {WALLETS.map((w, i) => (
                <button
                  key={w.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  role="menuitem"
                  data-testid={`wallet-${w.id}`}
                  onClick={() => onSelect(w)}
                  className="group flex w-full items-center gap-3 border border-border bg-black/40 px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-border bg-white/5">
                    <WalletLogo src={w.logo} className="h-5 w-5 object-contain" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono text-sm uppercase tracking-wide text-fg">
                      {w.name}
                    </span>
                    <span className="truncate font-mono text-[clamp(0.66rem,0.6rem+0.25vw,0.72rem)] uppercase tracking-wide text-muted">
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

            <p className="shrink-0 border-t border-border px-4 py-3 font-mono text-[clamp(0.66rem,0.6rem+0.25vw,0.72rem)] leading-relaxed text-muted">
              Demo mode — wallets are simulated.
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
