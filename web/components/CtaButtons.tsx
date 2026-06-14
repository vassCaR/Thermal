"use client";

import { useCallback, useRef, useState } from "react";
import { useWalletAddress, useTipSigner } from "@/lib/wallet";
import { api, ApiError } from "@/lib/client";
import { signTipMock, type TipSignFn } from "@/lib/tip";

const DEFAULT_CREATOR = "ghost:alice";
const FEATURED_CREATORS = ["ghost:alice", "ghost:bob", "ghost:carol"] as const;
const DEMO_FUNDING = "100.000000"; // auto-funded so the demo never hits "insufficient funds"
const PRESETS = ["0.10", "0.50", "1.00", "5.00"] as const;

/** Parse a user-entered amount into a 6-decimal USDC string, or null if invalid. */
function toUsdc(input: string): string | null {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(6);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** SUPPORT CREATORS: choose a creator, pick an amount (preset or custom) and
 *  send it in one tap, OR run the scripted DEMO that replays the whole MOCK path
 *  end-to-end. Account + funding live in refs (in-memory, no localStorage).
 *  When `creatorId` is provided (e.g. the per-creator page), the creator is
 *  fixed and the picker is hidden. */
export function CtaButtons({ creatorId }: { creatorId?: string } = {}) {
  const address = useWalletAddress();
  const signer = useTipSigner();
  const [creator, setCreator] = useState<string>(creatorId ?? DEFAULT_CREATOR);
  const [amount, setAmount] = useState<string>("1.00");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [spent, setSpent] = useState("0.000000");
  const [error, setError] = useState<string | null>(null);
  const [demoStep, setDemoStep] = useState<string | null>(null);

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

  // Ensure we have a funded private account. Recovers if the server restarted
  // and forgot the account (404).
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

  // Core money path shared by the manual button AND the demo runner: sign + tip
  // an explicit amount, then refresh the fan-only "supported so far" total.
  // `sign` is injected so the manual flow can use a REAL wallet signature while
  // the scripted demo uses the mock signer (no per-tip wallet popups).
  // Recovers once from a server restart (404) or depleted balance (402).
  const supportOnce = useCallback(
    async (value: string, sign: TipSignFn) => {
      let fan = await ensureFunded();
      const tip = async (f: string) => {
        nonceRef.current += 1;
        const auth = await sign({
          fanAccountId: f,
          creatorId: creator,
          amount: value,
          nonce: nonceRef.current,
          ts: Date.now(),
        });
        await api.tip(auth);
      };
      try {
        await tip(fan);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 402)) {
          if (e.status === 404) fan = await onboardFresh();
          await api.deposit({ fanAccountId: fan, amount: DEMO_FUNDING });
          fundedRef.current = true;
          await tip(fan);
        } else {
          throw e;
        }
      }
      const r = await api.meSpent(fan);
      setSpent(r.total);
    },
    [ensureFunded, onboardFresh, creator],
  );

  const value = toUsdc(custom !== "" ? custom : amount);
  const label = value ? Number(value).toFixed(2) : "—";

  const onSupport = useCallback(async () => {
    if (!value) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Real wallet signature when connected; mock otherwise.
      await supportOnce(value, signer.sign);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "";
      setError(
        /signature|rejected/i.test(msg)
          ? "Signature rejected in your wallet — support not sent."
          : "Could not send support — is the server (:8787) running?",
      );
    } finally {
      setBusy(false);
    }
  }, [value, supportOnce, signer.sign]);

  // Scripted happy-path demo. Reuses supportOnce (no duplicated business logic);
  // every step is clearly labelled "simulated" to stay honest with judges.
  const runDemo = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setDemoStep("① Wallet connected — simulated");
      await sleep(650);
      for (const amt of ["1.00", "5.00"] as const) {
        setAmount(amt);
        setCustom("");
        setDemoStep(`② Selected ${amt} USDC`);
        await sleep(550);
        setDemoStep("③ Sending private support…");
        await supportOnce(Number(amt).toFixed(6), signTipMock);
        await sleep(450);
      }
      setDemoStep("④ Settled on Arc testnet — simulated");
      await sleep(900);
      setDemoStep("✓ Demo complete — replay anytime");
    } catch (e) {
      console.error(e);
      setError("Demo failed — is the server (:8787) running?");
      setDemoStep(null);
    } finally {
      setBusy(false);
    }
  }, [supportOnce]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Honest mode badge. When a real wallet is connected, each support is
          signed for real (EIP-191) — only the USDC settlement stays simulated. */}
      <span
        data-testid="demo-badge"
        className="inline-flex items-center gap-2 border border-accent/60 px-3 py-1 font-mono text-[clamp(0.66rem,0.6rem+0.25vw,0.72rem)] uppercase tracking-[0.2em] text-accent"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        {signer.real ? "Live wallet · settlement simulated" : "Demo mode — simulated"}
      </span>

      {/* Creator selector — choose who to support (hidden when fixed by a page) */}
      {!creatorId && (
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-[clamp(0.66rem,0.6rem+0.25vw,0.72rem)] uppercase tracking-[0.2em] text-muted">
            supporting
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {FEATURED_CREATORS.map((c) => {
              const active = creator === c;
              return (
                <button
                  key={c}
                  type="button"
                  data-testid={`creator-${c}`}
                  aria-pressed={active}
                  disabled={busy}
                  onClick={() => setCreator(c)}
                  className={`border px-3 py-1.5 font-mono text-[clamp(0.78rem,0.7rem+0.4vw,0.82rem)] lowercase tracking-wide outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${
                    active
                      ? "border-accent text-accent"
                      : "border-border text-muted hover:border-accent hover:text-fg"
                  }`}
                >
                  {c}
                </button>
              );
            })}
            <input
              type="text"
              value={creator}
              disabled={busy}
              data-testid="creator-custom"
              aria-label="Creator handle to support"
              onChange={(e) => setCreator(e.target.value)}
              placeholder="ghost:handle"
              className="w-[clamp(7rem,30vw,9rem)] border border-border bg-transparent px-3 py-1.5 text-center font-mono text-[clamp(0.78rem,0.7rem+0.4vw,0.82rem)] lowercase text-fg outline-none transition-colors focus:border-accent placeholder:text-muted/70 disabled:opacity-50"
            />
          </div>
        </div>
      )}

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
              disabled={busy}
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
              className={`border-2 px-5 py-3 font-mono text-base uppercase tracking-wide outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${
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
            disabled={busy}
            data-testid="amount-custom"
            aria-label="Custom amount in USDC"
            onChange={(e) => setCustom(e.target.value)}
            className="w-[clamp(4.5rem,18vw,6rem)] bg-transparent text-center outline-none placeholder:text-muted/70 disabled:opacity-50"
          />
          <span className="ml-1 text-muted">USDC</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          data-testid="support-creators"
          onClick={onSupport}
          disabled={busy}
          className="gt-brutal-btn"
        >
          {busy && !demoStep ? "SUPPORTING…" : `SUPPORT ${label} USDC`}
        </button>
        <button
          type="button"
          data-testid="run-demo"
          onClick={runDemo}
          disabled={busy}
          className="inline-flex select-none items-center gap-2 border-2 border-accent bg-accent px-8 py-5 font-mono text-lg uppercase tracking-wide text-bg outline-none transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/85 focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <span aria-hidden>▶</span> Run Demo
        </button>
      </div>

      {demoStep && (
        <p
          data-testid="demo-step"
          role="status"
          className="font-mono text-sm uppercase tracking-wide text-accent"
        >
          {demoStep}
        </p>
      )}

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
