"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWalletAddress } from "@/lib/wallet";
import { api } from "@/lib/client";

// useSearchParams => dynamic route (avoids the static prerender error)
export const dynamic = "force-dynamic";

export default function Dashboard() {
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header>
        <h1 className="text-2xl font-bold text-white">Dashboard — {creatorId}</h1>
        <p className="subtitle">support received, fully anonymous.</p>
      </header>

      <section className="gt-panel text-center">
        <p className="subtitle text-sm">total received</p>
        <p className="my-4 font-mono text-5xl text-green-400">{total}</p>
        <p className="text-xs text-ghost-muted">
          No fan identity is stored. It is impossible to know who supported you.
        </p>
      </section>

      <section className="gt-panel space-y-3">
        <button className="gt-btn" onClick={withdraw}>
          Withdraw to my wallet
        </button>
        {lastTx && (
          <p className="text-sm text-ghost-muted">
            Arc settlement: <code>{lastTx}</code>
          </p>
        )}
      </section>
    </main>
  );
}
