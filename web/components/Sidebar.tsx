"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { spring } from "@/lib/motion";

const ABOUT =
  "Ghost Tips is a private support platform for content creators and journalists. Back the voices that matter, and keep the link between you and who you support completely anonymous. No one, not even us, can see who you back.";
const HOW =
  "Hold to support a creator and you give a tiny amount of USDC every second. Payments are routed privately and settled on Arc; the creator only ever sees an anonymous total. Release to stop. Verified support, invisible to the world.";

function SidebarContent() {
  return (
    <div className="flex h-full flex-col gap-7 overflow-y-auto p-5">
      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo_ghost_tips.svg"
          alt="Ghost Tips"
          className="h-12 w-12 border border-border"
        />
        <div className="font-display text-3xl font-black uppercase leading-[0.95] text-accent">
          GHOST
          <br />
          TIPS
        </div>
      </div>

      <section className="space-y-2">
        <p className="gt-section-label">&#8627; ABOUT US</p>
        <p className="gt-body text-[15px]">{ABOUT}</p>
      </section>

      <section className="space-y-2">
        <p className="gt-section-label">&#8627; HOW IT WORKS</p>
        <p className="gt-body text-[15px]">{HOW}</p>
      </section>

      <section className="space-y-2">
        <p className="gt-section-label">&#8627; LINKS / SOCIAL</p>
        <a
          className="gt-frame-link"
          href="https://github.com/vassCaR/ghost-tips"
          target="_blank"
          rel="noreferrer"
        >
          <span>GitHub</span>
          <span aria-hidden>&rarr;</span>
        </a>
        <a
          className="gt-frame-link"
          href="https://t.me/vasscar"
          target="_blank"
          rel="noreferrer"
        >
          <span>Telegram</span>
          <span aria-hidden>&rarr;</span>
        </a>
      </section>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: dense fixed column */}
      <aside className="hidden w-[280px] shrink-0 md:block">
        <SidebarContent />
      </aside>

      {/* Mobile: hamburger + drawer */}
      <button
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-3 z-40 flex h-10 w-10 flex-col items-center justify-center gap-1.5 border border-border bg-black/80 outline-none backdrop-blur focus-visible:ring-2 focus-visible:ring-accent md:hidden"
      >
        <span className="h-0.5 w-5 bg-fg" />
        <span className="h-0.5 w-5 bg-fg" />
        <span className="h-0.5 w-5 bg-fg" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60" />
            <motion.aside
              onClick={(e) => e.stopPropagation()}
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={spring}
              className="absolute left-0 top-0 h-full w-[280px] max-w-[85vw] border-r border-border bg-bg"
            >
              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 z-10 font-mono text-xs uppercase text-muted outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
              >
                Close
              </button>
              <SidebarContent />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
