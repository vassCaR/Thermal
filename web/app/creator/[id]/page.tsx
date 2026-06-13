"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/client";
import { signTip } from "@/lib/tip";
import { fadeUp, spring } from "@/lib/motion";

const TICK_AMOUNT = "0.002000"; // USDC per second

export default function CreatorPage() {
  const params = useParams<{ id: string }>();
  const creatorId = decodeURIComponent(params.id ?? "ghost:alice");

  const [fanAccountId, setFanAccountId] = useState<string | null>(null);
  const [spent, setSpent] = useState("0.000000");
  const [supporting, setSupporting] = useState(false);
  const nonceRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setFanAccountId(localStorage.getItem("gt_fanAccountId"));
  }, []);

  const tickOnce = useCallback(async () => {
    if (!fanAccountId) return;
    nonceRef.current += 1;
    const auth = await signTip({
      fanAccountId,
      creatorId,
      amount: TICK_AMOUNT,
      nonce: nonceRef.current,
      ts: Date.now(),
    });
    try {
      await api.tip(auth);
      const r = await api.meSpent(fanAccountId);
      setSpent(r.total);
    } catch (e) {
      console.error(e);
    }
  }, [fanAccountId, creatorId]);

  function start() {
    if (timerRef.current || !fanAccountId) return;
    setSupporting(true);
    void tickOnce();
    timerRef.current = setInterval(() => void tickOnce(), 1000);
  }
  function stop() {
    setSupporting(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }
  useEffect(() => () => stop(), []);

  async function deposit() {
    if (!fanAccountId) return;
    await api.deposit({ fanAccountId, amount: "5.000000" });
    alert("Private account topped up with 5 USDC (mock).");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="flex items-center gap-4"
      >
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-ghost-accent to-ghost-accent2" />
        <div>
          <h1 className="text-2xl font-bold text-white">{creatorId}</h1>
          <p className="subtitle">support them secretly, by the second.</p>
        </div>
      </motion.div>

      {!fanAccountId && (
        <div className="gt-panel text-amber-400">
          You don&apos;t have a private account yet.{" "}
          <a className="underline" href="/">
            Go back to the home page
          </a>{" "}
          to create one.
        </div>
      )}

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="gt-panel flex flex-col items-center gap-6 py-12"
      >
        <motion.button
          data-testid="hold-support"
          className="gt-btn select-none px-10 py-6 text-lg"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          disabled={!fanAccountId}
          whileTap={{ scale: 0.96 }}
          animate={supporting ? { scale: [1, 1.035, 1] } : { scale: 1 }}
          transition={
            supporting ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : spring
          }
        >
          {supporting ? "Supporting… (release to stop)" : "Hold to support"}
        </motion.button>
        <p className="text-sm text-ghost-muted">
          You&apos;ve quietly given{" "}
          <motion.span
            key={spent}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={spring}
            data-testid="spent"
            className="inline-block font-mono text-green-400"
          >
            {spent} USDC
          </motion.span>
        </p>
        <button className="gt-btn-ghost text-sm" onClick={deposit} disabled={!fanAccountId}>
          + Add 5 USDC
        </button>
      </motion.section>

      <p className="text-center text-xs text-ghost-muted">
        Nobody will know it&apos;s you. The fan&rarr;creator link and the amounts stay private.
      </p>
    </main>
  );
}
