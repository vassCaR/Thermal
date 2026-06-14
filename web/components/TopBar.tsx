"use client";

import { GhostLogo } from "@/components/GhostLogo";

const LINKS = [
  { label: "About us", href: "#about" },
  { label: "How it works", href: "#how" },
];

/** Slim top navigation. About us / How it works on the left; brand on the right. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-black/40 backdrop-blur-md">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
        <ul className="flex items-center gap-6">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="group relative font-mono text-[13px] uppercase tracking-[0.15em] text-muted transition-colors duration-200 hover:text-fg"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-accent transition-all duration-300 group-hover:w-full" />
              </a>
            </li>
          ))}
        </ul>

        <a href="#top" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <GhostLogo className="h-5 w-5" />
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.25em] text-fg">
            Ghost
          </span>
        </a>
      </nav>
    </header>
  );
}
