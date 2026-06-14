"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useWalletAddress } from "@/lib/wallet";
import { api, ApiError } from "@/lib/client";
import { spring } from "@/lib/motion";

// useSearchParams => dynamic route (avoids the static prerender error)
export const dynamic = "force-dynamic";

const isEvmAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

// useSearchParams() must sit under a Suspense boundary or the production build
// bails out of prerendering with a CSR error. Wrap the inner component below.
export default function Dashboard() {
  return (
    <Suspense fallback={null}>
      <DashboardInner />
    </Suspense>
  );
}

function DashboardInner() {
  const sp = useSearchParams();
  const address = useWalletAddress();
  const [creatorId, setCreatorId] = useState(sp.get("id") ?? "ghost:alice");
  const [total, setTotal] = useState("0.000000");
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const realWallet = isEvmAddress(address);

  // Poll the anonymous total received by this creator handle.
  useEffect(() => {
    let alive = true;
    const fetchBalance = async () => {
      try {
        const r = await api.creatorBalance(creatorId);
        if (alive) setTotal(r.total);
      } catch (e) {
        console.error(e);
      }
    };
    void fetchBalance();
    const t = setInterval(fetchBalance, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [creatorId]);

  // Declare yourself as this creator: register the connected wallet as the
  // on-chain payout address (the registry the real Circle adapter reads).
  async function becomeCreator() {
    setMsg(null);
    if (!realWallet) {
      setMsg("Connect a wallet first — its address becomes your payout address.");
      return;
    }
    try {
      await api.setPayoutAddress(creatorId, address);
      setRegistered(true);
      setMsg(`You are registered as ${creatorId}. Payouts go to ${address.slice(0, 6)}…${address.slice(-4)}.`);
    } catch (e) {
      const m = e instanceof ApiError ? `(${e.status})` : "";
      setMsg(`Could not register payout address ${m}. Is the server running?`);
    }
  }

  async function withdraw() {
    setMsg(null);
    try {
      const r = await api.withdraw({ creatorId, toAddress: address });
      setLastTx(r.txRef);
    } catch (e) {
      const m = e instanceof ApiError ? `(${e.status})` : "";
      setMsg(
        e instanceof ApiError && e.status === 409
          ? "Nothing to withdraw yet — receive some support first."
          : `Withdraw failed ${m}.`,
      );
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-28">
      <header>
        <p className="gt-eyebrow mb-1">Creator dashboard</p>
        <h1 className="font-display text-3xl font-black uppercase text-fg">
          {creatorId}
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-wide text-muted">
          support received — fully anonymous
        </p>
      </header>

      {/* Declare yourself as a creator */}
      <section className="gt-card space-y-4">
        <p className="font-display text-lg font-black uppercase text-fg">
          Become a creator
        </p>
        <label className="block font-mono text-[clamp(0.72rem,0.66rem+0.3vw,0.78rem)] uppercase tracking-wide text-muted">
          Your creator handle
          <input
            type="text"
            value={creatorId}
            data-testid="creator-handle"
            onChange={(e) => {
              setCreatorId(e.target.value);
              setRegistered(false);
            }}
            placeholder="ghost:yourname"
            className="mt-2 w-full border border-border bg-transparent px-3 py-2 text-center font-mono text-base lowercase text-fg outline-none focus:border-accent"
          />
        </label>
        <p className="font-mono text-[clamp(0.72rem,0.66rem+0.3vw,0.78rem)] leading-relaxed text-muted">
          Payout wallet:{" "}
          <span className={realWallet ? "text-accent" : "text-fg/60"}>
            {realWallet ? address : "connect a wallet (top-right) to set payout"}
          </span>
        </p>
        <button
          type="button"
          data-testid="become-creator"
          onClick={becomeCreator}
          className="gt-brutal-btn w-full"
        >
          {registered ? "Registered ✓ — update payout" : "Register as creator"}
        </button>
      </section>

      {/* Anonymous total + withdraw */}
      <section className="gt-card text-center">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          total received
        </p>
        <motion.p
          key={total}
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={spring}
          data-testid="creator-total"
          className="my-4 font-mono text-5xl text-accent"
        >
          {total}
        </motion.p>
        <p className="font-mono text-[clamp(0.66rem,0.6rem+0.25vw,0.72rem)] leading-relaxed text-muted">
          No fan identity is stored. It is impossible to know who supported you.
        </p>
        <button
          data-testid="withdraw"
          className="gt-brutal-btn mt-6 w-full"
          onClick={withdraw}
        >
          Withdraw to my wallet
        </button>
        {lastTx && (
          <p className="mt-4 font-mono text-xs text-muted">
            Arc settlement: <code className="text-accent">{lastTx}</code>
          </p>
        )}
      </section>

      {msg && (
        <p role="status" className="font-mono text-sm text-accent">
          {msg}
        </p>
      )}

      <a href="/" className="self-center font-mono text-xs uppercase tracking-wide text-muted hover:text-fg">
        ← back home
      </a>
    </div>
  );
}
