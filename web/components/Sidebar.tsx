"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion";

/** Hamburger button (top-right) opening a slide-in sidebar with section anchors. */
export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="fixed right-5 top-5 z-40 flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-ghost-border bg-ghost-panel/70 outline-none backdrop-blur-md transition hover:border-ghost-accent focus-visible:ring-2 focus-visible:ring-ghost-accent"
      >
        <span className="h-0.5 w-5 rounded bg-white" />
        <span className="h-0.5 w-5 rounded bg-white" />
        <span className="h-0.5 w-5 rounded bg-white" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.nav
              onClick={(e) => e.stopPropagation()}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={spring}
              className="absolute left-0 top-0 flex h-full w-72 flex-col gap-2 border-r border-ghost-border bg-ghost-panel p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-bold text-white">Ghost Tips</span>
                <button
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="rounded text-ghost-muted outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-ghost-accent"
                >
                  Close
                </button>
              </div>
              <a
                href="#about"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-white transition hover:bg-white/10"
              >
                About Us
              </a>
              <a
                href="#how-it-works"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-white transition hover:bg-white/10"
              >
                How It Works
              </a>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
