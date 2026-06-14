"use client";

import { ConnectButton } from "@/components/ConnectButton";

const LINKS = [
  { label: "About us", href: "#about" },
  { label: "How it works", href: "#how" },
];

/** Top navigation. Left: THERMAL wordmark + primary links. Right: Connect Wallet.
 *  Flex space-between, vertically centered, responsive (links collapse on small
 *  screens so the bar never overflows horizontally). */
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
                  className="group relative inline-flex items-center px-1 py-2 font-mono text-[15px] uppercase tracking-[0.18em] text-muted transition-colors duration-200 hover:text-fg"
                >
                  {l.label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: wallet CTA (compact navbar variant) */}
        <div className="flex shrink-0 items-center">
          <ConnectButton compact />
        </div>
      </nav>
    </header>
  );
}
