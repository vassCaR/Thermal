"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useWalletAddress } from "@/lib/wallet";
import { api } from "@/lib/client";
import { signTip } from "@/lib/tip";
import { container, fadeUp, spring } from "@/lib/motion";

const FEATURED_CREATOR = "ghost:alice";
const TICK_AMOUNT = "0.002000"; // USDC per second
const DEMO_FUNDING = "100.000000"; // auto-funded once so the demo never hits "insufficient funds"

export default function Home() {
  const address = useWalletAddress();
  const [supporting, setSupporting] = useState(false);
  const [spent, setSpent] = useState("0.000000");

  const fanRef = useRef<string | null>(null);
  const fundedRef = useRef(false);
  const nonceRef = useRef(0);
  const holdingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fanRef.current = localStorage.getItem("gt_fanAccountId");
  }, []);

  // Make sure we have a private account + some balance before the first tick.
  const ensureReady = useCallback(async () => {
    let fan = fanRef.current;
    if (!fan) {
      const { fanAccountId } = await api.onboard({ dynamicAddress: address });
      fan = fanAccountId;
      fanRef.current = fanAccountId;
      localStorage.setItem("gt_fanAccountId", fanAccountId);
    }
    if (!fundedRef.current) {
      await api.deposit({ fanAccountId: fan, amount: DEMO_FUNDING });
      fundedRef.current = true;
    }
    return fan;
  }, [address]);

  const tick = useCallback(async () => {
    const fan = fanRef.current;
    if (!fan) return;
    nonceRef.current += 1;
    const auth = await signTip({
      fanAccountId: fan,
      creatorId: FEATURED_CREATOR,
      amount: TICK_AMOUNT,
      nonce: nonceRef.current,
      ts: Date.now(),
    });
    try {
      await api.tip(auth);
      const r = await api.meSpent(fan);
      setSpent(r.total);
    } catch (e) {
      console.error(e);
    }
  }, []);

  async function startSupport() {
    if (holdingRef.current) return;
    holdingRef.current = true;
    setSupporting(true);
    try {
      await ensureReady();
    } catch (e) {
      console.error(e);
      holdingRef.current = false;
      setSupporting(false);
      alert("Could not start support — is the server (:8787) running?");
      return;
    }
    if (!holdingRef.current) return; // released during setup
    void tick();
    timerRef.current = setInterval(() => void tick(), 1000);
  }

  function stopSupport() {
    holdingRef.current = false;
    setSupporting(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => () => stopSupport(), []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-3xl space-y-8"
      >
        <motion.h1
          variants={fadeUp}
          className="text-5xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-7xl"
        >
          Support who matters.
          <br />
          <span className="text-ghost-accent2">Anonymously.</span>
        </motion.h1>

        <motion.p variants={fadeUp} className="mx-auto max-w-xl text-lg text-ghost-fg/80">
          Per-second support for creators and journalists. The link between you and
          who you support stays private.
        </motion.p>

        <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 pt-2">
          <motion.button
            onPointerDown={startSupport}
            onPointerUp={stopSupport}
            onPointerLeave={stopSupport}
            whileTap={{ scale: 0.97 }}
            animate={supporting ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={
              supporting ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : spring
            }
            className="gt-btn select-none px-10 py-5 text-lg"
            data-testid="support-creators"
          >
            {supporting ? "Supporting… (release to stop)" : "Support Creators — hold"}
          </motion.button>

          <p className="text-sm text-ghost-muted">
            supported so far:{" "}
            <motion.span
              key={spent}
              initial={{ scale: 1.25 }}
              animate={{ scale: 1 }}
              transition={spring}
              data-testid="supported-total"
              className="inline-block font-mono text-green-400"
            >
              {spent} USDC
            </motion.span>
          </p>
          <p className="text-xs text-ghost-muted">Nobody can see that it&apos;s you.</p>
        </motion.div>

        <motion.div variants={fadeUp} className="pt-4">
          <Link
            href="/dashboard?id=ghost:alice"
            className="text-sm text-ghost-muted underline-offset-4 transition hover:text-white hover:underline"
          >
            See the creator&apos;s anonymous total &rarr;
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}
