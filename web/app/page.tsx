"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import { useWalletAddress } from "@/lib/wallet";
import { api } from "@/lib/client";

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
      <header className="space-y-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_ghost_tips.svg" alt="Ghost Tips" className="gt-logo h-14 w-14" />
        <h1 className="text-6xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.6)]">
          Ghost Tips
        </h1>
        <p className="subtitle text-lg">
          support anyone, by the second — without anyone knowing it&apos;s you.
        </p>
      </header>

      <section className="gt-panel space-y-4">
        <h2 className="subtitle text-sm">1 · your wallet</h2>
        <ConnectButton />
      </section>

      <section className="gt-panel space-y-4">
        <h2 className="subtitle text-sm">2 · become a fan (private)</h2>
        {fanAccountId ? (
          <p className="text-sm text-ghost-accent2">
            Private account ready: <code className="text-ghost-muted">{fanAccountId}</code>
          </p>
        ) : (
          <button className="gt-btn" onClick={becomeFan} disabled={busy}>
            {busy ? "..." : "Create my private account"}
          </button>
        )}
      </section>

      <section className="flex flex-wrap gap-3">
        <Link className="gt-btn-ghost" href="/creator/ghost:alice">
          View a Creator
        </Link>
        <Link className="gt-btn-ghost" href="/dashboard?id=ghost:alice">
          Creator Dashboard
        </Link>
      </section>

      {/* ABOUT US */}
      <section id="about" className="gt-panel scroll-mt-24 space-y-3">
        <h2 className="text-2xl font-bold text-white">About Us</h2>
        <p className="text-ghost-muted">
          Ghost Tips lets you support creators and activists with per-second USDC
          tips — while keeping who-supports-whom completely private. Nobody can
          reconstruct the link between a fan and a creator on-chain.
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="gt-panel scroll-mt-24 space-y-3">
        <h2 className="text-2xl font-bold text-white">How It Works</h2>
        <ol className="list-decimal space-y-1 pl-5 text-ghost-muted">
          <li>Connect a wallet (no seed phrase) and create a private account.</li>
          <li>Hold to support a creator — you tip a tiny amount every second.</li>
          <li>Payments are routed privately and settled on Arc.</li>
          <li>The creator only sees an anonymous total they can withdraw.</li>
        </ol>
      </section>
    </main>
  );
}
