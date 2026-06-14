"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useWalletAddress } from "@/lib/wallet";
import { api } from "@/lib/client";
import { spring } from "@/lib/motion";

// useSearchParams => dynamic route (avoids the static prerender error)
export const dynamic = "force-dynamic";

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
  const creatorId = sp.get("id") ?? "ghost:alice";
  const address = useWalletAddress();
  const [total, setTotal] = useState("0.000000");
  const [lastTx, setLastTx] = useState<string | null>(null);

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

  async function withdraw() {
    const r = await api.withdraw({ creatorId, toAddress: address });
    setLastTx(r.txRef);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-24">
      <header>
        <p className="gt-eyebrow mb-1">Creator dashboard</p>
        <h1 className="font-display text-3xl font-black uppercase text-fg">
          {creatorId}
        </h1>
        <p className="mt-1 font-mono text-xs uppercase tracking-wide text-muted">
          support received, fully anonymous
        </p>
      </header>

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
        <p className="font-mono text-[11px] leading-relaxed text-muted">
          No fan identity is stored. It is impossible to know who supported you.
        </p>
      </section>

      <section className="gt-card space-y-4">
        <button
          data-testid="withdraw"
          className="gt-brutal-btn w-full"
          onClick={withdraw}
        >
          Withdraw to my wallet
        </button>
        {lastTx && (
          <p className="font-mono text-xs text-muted">
            Arc settlement: <code className="text-accent">{lastTx}</code>
          </p>
        )}
      </section>
    </div>
  );
}
