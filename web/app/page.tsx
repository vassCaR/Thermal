"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ConnectButton } from "@/components/ConnectButton";
import { useWalletAddress } from "@/lib/wallet";
import { api } from "@/lib/client";
import { container, fadeUp } from "@/lib/motion";

const MotionLink = motion.create(Link);

export default function Home() {
  const address = useWalletAddress();
  const [fanAccountId, setFanAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFanAccountId(localStorage.getItem("gt_fanAccountId"));
  }, []);

  async function becomeFan() {
    setBusy(true);
    try {
      const { fanAccountId } = await api.onboard({ dynamicAddress: address });
      localStorage.setItem("gt_fanAccountId", fanAccountId);
      setFanAccountId(fanAccountId);
    } catch (e) {
      console.error(e);
      alert("Onboarding failed — is the server (:8787) running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-20">
      {/* HERO */}
      <motion.header
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          variants={fadeUp}
          src="/logo_ghost_tips.svg"
          alt="Ghost Tips"
          className="gt-logo h-14 w-14"
        />
        <motion.h1 variants={fadeUp} className="gt-title">
          Ghost Tips
        </motion.h1>
        <motion.p variants={fadeUp} className="subtitle text-lg">
          support anyone, by the second — without anyone knowing it&apos;s you.
        </motion.p>
      </motion.header>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="gt-panel space-y-4"
      >
        <h2 className="subtitle text-sm">1 · your wallet</h2>
        <ConnectButton />
      </motion.section>

      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="gt-panel space-y-4"
      >
        <h2 className="subtitle text-sm">2 · become a fan (private)</h2>
        {fanAccountId ? (
          <p className="text-sm text-ghost-accent2">
            Private account ready: <code className="text-ghost-muted">{fanAccountId}</code>
          </p>
        ) : (
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="gt-btn"
            onClick={becomeFan}
            disabled={busy}
          >
            {busy ? "Creating…" : "Create my private account"}
          </motion.button>
        )}
      </motion.section>

      <section className="flex flex-wrap gap-3">
        <MotionLink
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="gt-btn-ghost"
          href="/creator/ghost:alice"
        >
          View a Creator
        </MotionLink>
        <MotionLink
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="gt-btn-ghost"
          href="/dashboard?id=ghost:alice"
        >
          Creator Dashboard
        </MotionLink>
      </section>

      {/* ABOUT US */}
      <motion.section
        id="about"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="gt-panel scroll-mt-24 space-y-3"
      >
        <h2 className="gt-h2">About Us</h2>
        <p className="gt-body">
          Ghost Tips lets you support creators and activists with per-second USDC
          tips — while keeping who-supports-whom completely private. Nobody can
          reconstruct the link between a fan and a creator on-chain.
        </p>
      </motion.section>

      {/* HOW IT WORKS */}
      <motion.section
        id="how-it-works"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="gt-panel scroll-mt-24 space-y-3"
      >
        <h2 className="gt-h2">How It Works</h2>
        <ol className="gt-body list-decimal space-y-1 pl-5">
          <li>Connect a wallet (no seed phrase) and create a private account.</li>
          <li>Hold to support a creator — you tip a tiny amount every second.</li>
          <li>Payments are routed privately and settled on Arc.</li>
          <li>The creator only sees an anonymous total they can withdraw.</li>
        </ol>
      </motion.section>
    </main>
  );
}
