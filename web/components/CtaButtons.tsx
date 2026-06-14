"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWalletAddress } from "@/lib/wallet";
import { api, ApiError } from "@/lib/client";
import { signTip } from "@/lib/tip";
import { ConnectButton } from "@/components/ConnectButton";

const FEATURED_CREATOR = "ghost:alice";
const TICK_AMOUNT = "0.002000"; // USDC per second
const DEMO_FUNDING = "100.000000"; // auto-funded once so the demo never hits "insufficient funds"

/** SUPPORT CREATORS (hold-to-support) + CONNECT WALLET, with the live anonymous counter. */
export function CtaButtons() {
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

  // Create a fresh private account and remember it. Resets the funded flag so the
  // next ensureReady() re-funds it.
  const onboardFresh = useCallback(async () => {
    const { fanAccountId } = await api.onboard({ dynamicAddress: address });
    fanRef.current = fanAccountId;
    nonceRef.current = 0;
    fundedRef.current = false;
    localStorage.setItem("gt_fanAccountId", fanAccountId);
    return fanAccountId;
  }, [address]);

  const ensureReady = useCallback(async () => {
    let fan = fanRef.current ?? localStorage.getItem("gt_fanAccountId");
    if (!fan) fan = await onboardFresh();
    fanRef.current = fan;
    if (!fundedRef.current) {
      try {
        await api.deposit({ fanAccountId: fan, amount: DEMO_FUNDING });
      } catch (e) {
        // Stored account is unknown to the server (e.g. the server restarted and
        // wiped its in-memory state) -> transparently re-onboard and re-fund.
        if (e instanceof ApiError && e.status === 404) {
          fan = await onboardFresh();
          await api.deposit({ fanAccountId: fan, amount: DEMO_FUNDING });
        } else {
          throw e;
        }
      }
      fundedRef.current = true;
    }
    return fan;
  }, [onboardFresh]);

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
      // Server restarted mid-hold -> recover a fresh funded account; the next
      // tick (1s later) resumes cleanly.
      if (e instanceof ApiError && e.status === 404) {
        try {
          await onboardFresh();
          await ensureReady();
        } catch (re) {
          console.error(re);
        }
      } else {
        console.error(e);
      }
    }
  }, [ensureReady, onboardFresh]);

  async function start() {
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
    if (!holdingRef.current) return;
    void tick();
    timerRef.current = setInterval(() => void tick(), 1000);
  }

  function stop() {
    holdingRef.current = false;
    setSupporting(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          data-testid="support-creators"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          className="gt-brutal-btn"
        >
          {supporting ? "SUPPORTING… (RELEASE)" : "SUPPORT CREATORS"}
        </button>
        <ConnectButton />
      </div>
      <p className="font-mono text-sm uppercase tracking-wide text-muted">
        supported so far:{" "}
        <span data-testid="supported-total" className="text-accent">
          {spent} USDC
        </span>{" "}
        — nobody can see it&apos;s you
      </p>
    </div>
  );
}
