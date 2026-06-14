"use client";

import { useCallback, useRef, useState } from "react";
import { useWalletAddress } from "@/lib/wallet";
import { api, ApiError } from "@/lib/client";
import { signTip } from "@/lib/tip";

const FEATURED_CREATOR = "ghost:alice";
const DEMO_FUNDING = "100.000000"; // auto-funded so the demo never hits "insufficient funds"
const PRESETS = ["0.10", "0.50", "1.00", "5.00"] as const;

/** Parse a user-entered amount into a 6-decimal USDC string, or null if invalid. */
function toUsdc(input: string): string | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(6);
}

/** SUPPORT CREATORS: pick an amount (preset or custom) and send it in one tap.
 *  Account + funding live in refs (in-memory, no localStorage). The live counter
 *  reflects the fan-only "supported so far" total. */
export function CtaButtons() {
  const address = useWalletAddress();
  const [amount, setAmount] = useState<string>("1.00");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [spent, setSpent] = useState("0.000000");
  const [error, setError] = useState<string | null>(null);

  const fanRef = useRef<string | null>(null);
  const fundedRef = useRef(false);
  const nonceRef = useRef(0);

  // Create a fresh private account; resets funding + nonce so it gets re-funded.
  const onboardFresh = useCallback(async () => {
    const { fanAccountId } = await api.onboard({ dynamicAddress: address });
    fanRef.current = fanAccountId;
    nonceRef.current = 0;
    fundedRef.current = false;
    return fanAccountId;
  }, [address]);

  // Ensure we have a funded private account. Recovers transparently if the server
  // restarted and forgot the account (404).
  const ensureFunded = useCallback(async () => {
    let fan = fanRef.current ?? (await onboardFresh());
    if (!fundedRef.current) {
      try {
        await api.deposit({ fanAccountId: fan, amount: DEMO_FUNDING });
      } catch (e) {
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

  const sendTip = useCallback(async (fan: string, value: string) => {
    nonceRef.current += 1;
    const auth = await signTip({
      fanAccountId: fan,
      creatorId: FEATURED_CREATOR,
      amount: value,
      nonce: nonceRef.current,
      ts: Date.now(),
    });
    await api.tip(auth);
  }, []);

  const value = toUsdc(custom !== "" ? custom : amount);
  const label = value ? Number(value).toFixed(2) : "—";

  const onSupport = useCallback(async () => {
    const v = toUsdc(custom !== "" ? custom : amount);
    if (!v) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let fan = await ensureFunded();
      try {
        await sendTip(fan, v);
      } catch (e) {
        // Recover from a server restart (404) or a depleted balance (402):
        // re-onboard/re-fund and retry once so the demo never dead-ends.
        if (e instanceof ApiError && (e.status === 404 || e.status === 402)) {
          if (e.status === 404) fan = await onboardFresh();
          await api.deposit({ fanAccountId: fan, amount: DEMO_FUNDING });
          fundedRef.current = true;
          await sendTip(fan, v);
        } else {
          throw e;
        }
      }
      const r = await api.meSpent(fan);
      setSpent(r.total);
    } catch (e) {
      console.error(e);
      setError("Could not send support — is the server (:8787) running?");
    } finally {
      setBusy(false);
    }
  }, [amount, custom, ensureFunded, onboardFresh, sendTip]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Amount selector: presets + custom field */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {PRESETS.map((p) => {
          const active = custom === "" && amount === p;
          return (
            <button
              key={p}
              type="button"
              data-testid={`amount-${p}`}
              aria-pressed={active}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
              className={`border-2 px-5 py-3 font-mono text-base uppercase tracking-wide outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? "border-accent bg-accent text-bg"
                  : "border-fg/40 text-fg hover:-translate-y-0.5 hover:border-accent"
              }`}
            >
              {p}
            </button>
          );
        })}
        <label className="flex items-center border-2 border-fg/40 px-3 py-3 font-mono text-base text-fg transition-colors focus-within:border-accent">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="custom"
            value={custom}
            data-testid="amount-custom"
            onChange={(e) => setCustom(e.target.value)}
            className="w-24 bg-transparent text-center outline-none placeholder:text-muted/70"
          />
          <span className="ml-1 text-muted">USDC</span>
        </label>
      </div>

      <button
        type="button"
        data-testid="support-creators"
        onClick={onSupport}
        disabled={busy}
        className="gt-brutal-btn"
      >
        {busy ? "SUPPORTING…" : `SUPPORT ${label} USDC`}
      </button>

      {error && (
        <p role="alert" className="font-mono text-sm text-accent">
          {error}
        </p>
      )}

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
