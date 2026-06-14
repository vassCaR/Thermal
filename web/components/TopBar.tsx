"use client";

import { ConnectButton } from "@/components/ConnectButton";

const REPO_URL = "https://github.com/vassCaR/ghost-tips";

// Left-nav links. Anchors point to existing on-page sections; Docs is the public
// repo (a real destination — no dead pages / 404s).
const LINKS = [
  { label: "About us", href: "#about", external: false },
  { label: "How it works", href: "#how", external: false },
  { label: "Dashboard", href: "/dashboard", external: false },
  { label: "Docs", href: REPO_URL, external: true },
];

/** Discreet network-status badge. Honest signal that the privacy-payment flow
 *  settles on Circle's Arc testnet (matches CHAIN_ENV=arc-testnet). */
function NetworkBadge() {
  return (
    <span
      title="Settlement network — Circle Arc (testnet)"
      className="hidden items-center gap-2 border border-border/70 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted md:inline-flex"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      Arc Testnet
    </span>
  );
}

/** Top navigation. Left: THERMAL wordmark + primary links (incl. Docs). Right:
 *  network badge + Connect Wallet. Flex space-between, vertically centered,
 *  responsive (links/badge collapse progressively so the bar never overflows). */
export function TopBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-black/40 backdrop-blur-md">
      <nav className="mx-auto box-border flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-5 sm:px-10">
        {/* Left cluster: wordmark + nav links */}
        <div className="flex min-w-0 items-center gap-6 sm:gap-10">
          <a
            href="#top"
            className="shrink-0 font-display text-lg font-extrabold uppercase tracking-[0.3em] text-fg transition-opacity hover:opacity-80 sm:text-xl"
          >
            Thermal
          </a>
          <ul className="hidden items-center gap-8 sm:flex lg:gap-10">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="group relative inline-flex items-center px-1 py-2 font-mono text-[15px] uppercase tracking-[0.18em] text-muted transition-colors duration-200 hover:text-fg focus-visible:text-fg focus-visible:outline-none"
                >
                  {l.label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full group-focus-visible:w-full" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Right cluster: network status + wallet CTA */}
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <NetworkBadge />
          <ConnectButton compact />
        </div>
      </nav>
    </header>
  );
}
