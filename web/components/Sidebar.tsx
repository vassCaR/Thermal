"use client";

import { useState } from "react";

/** Hamburger button (top-right) opening a slide-in sidebar with section anchors. */
export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="fixed right-5 top-5 z-40 flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-ghost-border bg-ghost-panel/70 backdrop-blur-md transition hover:border-ghost-accent"
      >
        <span className="h-0.5 w-5 rounded bg-white" />
        <span className="h-0.5 w-5 rounded bg-white" />
        <span className="h-0.5 w-5 rounded bg-white" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <nav
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 flex h-full w-72 flex-col gap-2 border-r border-ghost-border bg-ghost-panel p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-montserrat text-lg font-bold text-white">Ghost Tips</span>
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="text-ghost-muted transition hover:text-white"
              >
                Close
              </button>
            </div>
            <a
              href="#about"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 font-montserrat text-white transition hover:bg-white/10"
            >
              About Us
            </a>
            <a
              href="#how-it-works"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 font-montserrat text-white transition hover:bg-white/10"
            >
              How It Works
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
