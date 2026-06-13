"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { api } from "@/lib/client";
import { spring } from "@/lib/motion";

/** Floating "+" button (bottom-right) that opens a deposit (add funds) modal. */
export function FloatingDeposit() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("5.000000");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function deposit() {
    const fanAccountId =
      typeof window !== "undefined" ? localStorage.getItem("gt_fanAccountId") : null;
    if (!fanAccountId) {
      setMsg("Create a private account first (on the home page).");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.deposit({ fanAccountId, amount });
      setMsg(`New balance: ${r.balance} USDC`);
    } catch (e) {
      console.error(e);
      setMsg("Deposit failed — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        aria-label="Add funds"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ghost-accent text-3xl font-light leading-none text-white shadow-lg shadow-ghost-accent/40 outline-none focus-visible:ring-2 focus-visible:ring-ghost-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ghost-bg"
      >
        +
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.92, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={spring}
              className="relative w-full max-w-sm space-y-4 rounded-2xl border border-ghost-border bg-ghost-panel p-6"
            >
              <h3 className="text-xl font-bold text-white">Add funds</h3>
              <p className="subtitle text-xs">deposit usdc into your private account</p>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                aria-label="Amount in USDC"
                className="w-full rounded-xl border border-ghost-border bg-ghost-bg px-4 py-3 text-white outline-none transition focus:border-ghost-accent"
              />
              <button className="gt-btn w-full" onClick={deposit} disabled={busy}>
                {busy ? "Depositing…" : `Deposit ${amount} USDC`}
              </button>
              {msg && <p className="text-sm text-ghost-muted">{msg}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
