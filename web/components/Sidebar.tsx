"use client";

import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion";

/** Right-side slide-in panel with the project's explanatory sections. Controlled by the Header. */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.aside
            onClick={(e) => e.stopPropagation()}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={spring}
            className="absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col gap-6 overflow-y-auto border-l border-ghost-border bg-ghost-panel p-6"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-white">Ghost Tips</span>
              <button
                aria-label="Close menu"
                onClick={onClose}
                className="rounded text-ghost-muted outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-ghost-accent"
              >
                Close
              </button>
            </div>

            <section className="space-y-2">
              <h2 className="subtitle text-sm">Who We Are</h2>
              <p className="gt-body text-sm">
                Ghost Tips is a private support platform for content creators and
                journalists. You back the people whose work matters, and the link
                between you and who you support stays anonymous.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="subtitle text-sm">How to Support</h2>
              <ol className="gt-body list-decimal space-y-1 pl-5 text-sm">
                <li>Connect a wallet (no seed phrase needed).</li>
                <li>Hold the &quot;Support Creators&quot; button; you give a tiny amount every second.</li>
                <li>Release to stop. The creator receives an anonymous total they can withdraw.</li>
              </ol>
            </section>

            <section className="space-y-2">
              <h2 className="subtitle text-sm">Why Privacy</h2>
              <p className="gt-body text-sm">
                Supporting a journalist or an activist can be dangerous if it is
                public. On Ghost Tips, no one, not even us, can reconstruct who
                supported whom. Verified support, invisible to the world.
              </p>
            </section>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
