"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ConnectButton } from "@/components/ConnectButton";
import { Sidebar } from "@/components/Sidebar";

/** Top bar: logo (left) + Connect Wallet and hamburger (right). Hamburger opens the right Sidebar. */
export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Ghost Tips home" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_ghost_tips.svg" alt="Ghost Tips" className="gt-logo h-10 w-10" />
          <span className="hidden text-lg font-bold text-white sm:inline">Ghost Tips</span>
        </Link>

        <div className="flex items-center gap-3">
          <ConnectButton />
          <motion.button
            whileTap={{ scale: 0.9 }}
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-xl border border-ghost-border bg-ghost-panel/70 outline-none backdrop-blur-md transition hover:border-ghost-accent focus-visible:ring-2 focus-visible:ring-ghost-accent"
          >
            <span className="h-0.5 w-5 rounded bg-white" />
            <span className="h-0.5 w-5 rounded bg-white" />
            <span className="h-0.5 w-5 rounded bg-white" />
          </motion.button>
        </div>
      </header>

      <Sidebar open={open} onClose={() => setOpen(false)} />
    </>
  );
}
