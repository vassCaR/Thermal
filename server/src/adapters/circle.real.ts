/**
 * RealCircleSettlement — REAL Circle settlement adapter (used when MOCK=false).
 *
 * ============================================================================
 * WHAT THIS IS
 *   The real settlement seam onto Circle Nanopayments on Arc (Circle's L1).
 *   The batcher (src/batcher.ts) aggregates per-creator verified authorizations
 *   and calls settleBatch() ONCE per creator window; we settle them as a single
 *   USDC movement and hand back an anonymous txRef. withdraw() pays a creator's
 *   accrued balance out to a public address on Arc.
 *
 *   PRIVACY: SettlementItem deliberately carries NO fanAccountId. Nothing in
 *   this file derives, logs, or forwards a fan identity. The settlement is
 *   creator-only; the fan->creator link never reaches Circle.
 * ============================================================================
 *
 * REFERENCE STUDIED: https://github.com/circlefin/arc-nanopayments
 *   (cloned read-only to /tmp; this is Circle's official x402-batching demo).
 *   Key facts learned, and which are CONFIRMED vs ASSUMED, are tagged inline.
 *
 *   CONFIRMED from the reference (file:line cited where it lives in that repo):
 *     - The real SDK is `@circle-fin/x402-batching`, exposing:
 *         * `GatewayClient` from ".../client"  (agent.mts:1, deposit/pay/
 *           getBalances/withdraw) — the PAYER + the WITHDRAW side.
 *         * `BatchFacilitatorClient` from ".../server" (lib/x402.ts:19) — the
 *           SELLER/facilitator side: `.verify(payload, requirements)` then
 *           `.settle(payload, requirements)` aggregates signed off-chain
 *           authorizations into one gasless on-chain settlement.
 *     - Arc Testnet constants (lib/x402.ts, app/api/gateway/*):
 *         * network (CAIP-2)   "eip155:5042002"   (== arcTestnet, chainId 5042002)
 *         * USDC                0x3600000000000000000000000000000000000000
 *         * Gateway Wallet      0x0077777d7EBA4688BDeF3E311b846F25870A19B9
 *         * Gateway REST (bal)  https://gateway-api-testnet.circle.com/v1/balances
 *         * Arc CCTP domain     26
 *         * native gas on Arc is USDC with 18 decimals (agent.mts:77)
 *     - withdraw is `gateway.withdraw(amount, { chain, recipient })` and returns
 *       `{ mintTxHash, formattedAmount, sourceChain, destinationChain, recipient }`
 *       (app/api/gateway/withdraw/route.ts:156-176). Cross-chain uses CCTP.
 *     - x402 payment requirements `extra` block for Gateway batching:
 *         { name:"GatewayWalletBatched", version:"1", verifyingContract:<gateway> }
 *
 * WHY WE DON'T import @circle-fin/x402-batching HERE
 *   It is NOT a dependency of this server and a sibling agent owns package.json;
 *   importing it would fail typecheck (TS2307). `viem` IS a dependency and ships
 *   `arcTestnet`, so the on-chain paths below are real viem calls. The Gateway
 *   *balance* read uses the CONFIRMED public REST endpoint via fetch. The Gateway
 *   *batch-settlement submission* endpoint/payload is the one piece the demo only
 *   exercises through the SDK (BatchFacilitatorClient.settle) — so that exact wire
 *   format is ASSUMED and gated behind a TODO + DevRel question below, never
 *   invented-and-claimed-confirmed.
 *
 * TO GO LIVE: see the "GO LIVE CHECKLIST" at the bottom of this file.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  erc20Abi,
  parseUnits,
  isAddress,
  type PublicClient,
  type WalletClient,
  type Account,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";
import type { Config } from "../config.js";
import type { ResolveCreatorAddress } from "./index.js";
import type {
  CircleSettlementPort,
  SettleBatchInput,
  SettleBatchResult,
  WithdrawInput,
  WithdrawResult,
} from "../ports/circle.js";

/** USDC on Arc has 6 decimals (the ERC-20 amount unit). */
const USDC_DECIMALS = 6;

/**
 * Arc CCTP/Gateway domain id (CONFIRMED: arc-nanopayments
 * app/api/gateway/balance/route.ts:23 — `ARC_TESTNET_DOMAIN = 26`).
 * Only the testnet value is confirmed; CONFIRM the mainnet domain with DevRel.
 */
const ARC_GATEWAY_DOMAIN = 26;

/**
 * Circle Gateway REST base, derived from the CONFIRMED testnet balances URL
 * (arc-nanopayments app/api/gateway/balance/route.ts:22:
 *   https://gateway-api-testnet.circle.com/v1/balances).
 * We keep the host configurable via cfg.circleGatewayUrl so mainnet / a future
 * host can be swapped without code changes. Fallback is the confirmed testnet host.
 */
const DEFAULT_GATEWAY_BASE = "https://gateway-api-testnet.circle.com";

export class RealCircleSettlement implements CircleSettlementPort {
  readonly kind = "real" as const;

  private readonly account: Account;
  private readonly wallet: WalletClient;
  private readonly publicClient: PublicClient;
  private readonly usdc: `0x${string}`;
  private readonly gatewayBase: string;

  /**
   * Creator-only lookup that maps a CreatorId to its on-chain payout address.
   * Threaded in via buildAdapters (wired to Store.getCreatorPayoutAddress in
   * app.ts). Optional so the adapter can be constructed without it, in which case
   * resolveCreatorPayoutAddress falls back to the legacy "creatorId IS an address"
   * behaviour. NO fan data is ever involved — this is a creator->address map.
   */
  private readonly resolveCreatorAddress?: ResolveCreatorAddress;

  constructor(
    private readonly cfg: Config,
    resolveCreatorAddress?: ResolveCreatorAddress,
  ) {
    this.resolveCreatorAddress = resolveCreatorAddress;
    // NOTE: this constructor only runs when MOCK=false (see adapters/index.ts),
    // so there are no import-time side effects in MOCK mode.
    if (!cfg.settlerPrivateKey) {
      throw new Error(
        "RealCircleSettlement: SETTLER_PRIVATE_KEY is required when MOCK=false.",
      );
    }
    const pk = cfg.settlerPrivateKey.startsWith("0x")
      ? (cfg.settlerPrivateKey as `0x${string}`)
      : (`0x${cfg.settlerPrivateKey}` as `0x${string}`);

    this.account = privateKeyToAccount(pk);

    // Real viem clients over the Arc RPC. `arcTestnet` is shipped by viem and
    // matches CHAIN_ENV=arc-testnet. For Arc mainnet, swap the chain object once
    // viem ships it (CONFIRM the mainnet chain id with DevRel) — the transport
    // URL already comes from cfg.arcRpcUrl so only the `chain` field changes.
    this.wallet = createWalletClient({
      account: this.account,
      chain: arcTestnet,
      transport: http(cfg.arcRpcUrl),
    });
    this.publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(cfg.arcRpcUrl),
    });

    if (!isAddress(cfg.usdcAddress)) {
      throw new Error(
        `RealCircleSettlement: USDC_ADDRESS is not a valid address: "${cfg.usdcAddress}". ` +
          `On Arc testnet it is 0x3600000000000000000000000000000000000000.`,
      );
    }
    this.usdc = cfg.usdcAddress as `0x${string}`;

    // Strip a trailing "/v1/balances" or trailing slash if the operator pasted
    // the full balances URL into CIRCLE_GATEWAY_URL; we only want the host root.
    const raw = cfg.circleGatewayUrl || DEFAULT_GATEWAY_BASE;
    this.gatewayBase = raw.replace(/\/v1\/balances\/?$/, "").replace(/\/$/, "");
  }

  /**
   * Settle one aggregated per-creator batch into a SINGLE Circle Gateway
   * settlement, denominated in USDC. Returns an anonymous txRef.
   *
   * FLOW (mirrors arc-nanopayments BatchFacilitatorClient.settle, lib/x402.ts):
   *   1. Aggregate `items` -> one total (the batcher already pre-summed it in
   *      `input.total`; we re-derive defensively from items and assert they agree).
   *   2. Build ONE Gateway settlement request for { payTo: creator wallet, asset:
   *      USDC, amount: total, network: Arc }. The per-fan signed authorizations
   *      are NOT individually re-submitted here — the privacy + batching win is
   *      that N ticks collapse into one creator-only settlement.
   *   3. Submit to the Gateway facilitator and return its settlement id / on-chain
   *      tx hash as txRef.
   *
   * STATUS: steps 1-2 are real below. Step 3's exact endpoint+payload is the one
   * piece the reference only drives through the SDK (BatchFacilitatorClient), so
   * it is gated behind submitGatewaySettlement() with a precise TODO. We do NOT
   * fabricate a wire format and claim it works.
   */
  async settleBatch(input: SettleBatchInput): Promise<SettleBatchResult> {
    const { creatorId, items, total } = input;

    if (items.length === 0) {
      // Nothing to settle — return a no-op result rather than hitting the network.
      return { txRef: "0x", settledTotal: total, itemCount: 0 };
    }

    // (1) Re-derive the total from items in atomic USDC and assert it matches the
    // batcher's pre-sum. Both are USDC strings with 6 decimals (see src/usdc.ts).
    const totalAtomic = items.reduce(
      (acc, it) => acc + parseUnits(it.amount, USDC_DECIMALS),
      0n,
    );
    const expectedAtomic = parseUnits(total, USDC_DECIMALS);
    if (totalAtomic !== expectedAtomic) {
      throw new Error(
        `settleBatch: item sum (${totalAtomic}) != provided total (${expectedAtomic}); ` +
          `refusing to settle a mismatched batch.`,
      );
    }

    // (2) Resolve the creator's on-chain payout target (their Gateway/Arc wallet).
    //   The batch settles TO the creator only — no fan data is read or attached.
    const payTo = this.resolveCreatorPayoutAddress(creatorId);

    // (3) Submit the single aggregated settlement to Circle Gateway.
    const txRef = await this.submitGatewaySettlement({
      payTo,
      amountAtomic: totalAtomic,
      // CONFIRMED Arc CAIP-2 network id (arc-nanopayments lib/x402.ts:24).
      network: "eip155:5042002",
    });

    // Anonymous result: txRef + totals only. itemCount is a COUNT, not identities.
    return {
      txRef,
      settledTotal: total,
      itemCount: items.length,
    };
  }

  /**
   * Pay out a creator's accrued anonymous balance to a public address on Arc.
   *
   * Implemented as a REAL on-chain ERC-20 USDC transfer via viem (this genuinely
   * executes once SETTLER_PRIVATE_KEY holds USDC + native gas on Arc). This is the
   * "settle out of the pool to a public address" exit and mirrors the reference's
   * funder transfer (arc-nanopayments agent.mts:146 writeContract transfer).
   *
   * ALTERNATIVE (Gateway-native, CONFIRMED API shape but needs the SDK): the
   * reference withdraws via `gateway.withdraw(amount, { chain, recipient })`
   * returning `{ mintTxHash, ... }` (app/api/gateway/withdraw/route.ts:156). That
   * path also supports CROSS-CHAIN payout via CCTP. We can't import that SDK here
   * (not a dependency), so the on-chain transfer below is the working same-chain
   * exit; see GO LIVE CHECKLIST for switching to the SDK withdraw if cross-chain
   * payout is required.
   */
  async withdraw(input: WithdrawInput): Promise<WithdrawResult> {
    const { toAddress, amount } = input;

    if (!isAddress(toAddress)) {
      throw new Error(`withdraw: invalid toAddress "${toAddress}".`);
    }
    const amountAtomic = parseUnits(amount, USDC_DECIMALS);
    if (amountAtomic <= 0n) {
      throw new Error(`withdraw: amount must be positive, got "${amount}".`);
    }

    // Real ERC-20 transfer on Arc. `chain` and `account` are bound on the client.
    const hash = await this.wallet.writeContract({
      address: this.usdc,
      abi: erc20Abi,
      functionName: "transfer",
      args: [toAddress as `0x${string}`, amountAtomic],
      account: this.account,
      chain: arcTestnet,
    });

    // Wait for inclusion so the returned txRef is a settled, citable reference.
    await this.publicClient.waitForTransactionReceipt({ hash });

    return { txRef: hash };
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Map a creatorId to the on-chain address that should receive settlement.
   *
   * WIRED (TASK 1): the creator->address mapping now comes from the creator
   * registry (Store.getCreatorPayoutAddress), injected as `resolveCreatorAddress`
   * via the adapter factory (buildAdapters). Resolution order:
   *
   *   1. If a payout address has been registered for this creatorId in the store,
   *      use it. This is the normal multi-creator path: a creator's opaque handle
   *      (e.g. "ghost:alice") maps to the 0x address they registered via
   *      POST /api/creator/:id/payout-address.
   *   2. Back-compat fallback: if NO registry is wired (resolver absent) OR no
   *      address is registered, but the creatorId itself already IS a 0x address,
   *      use it directly (the original demo behaviour).
   *   3. Otherwise throw a clear, actionable error telling the operator to
   *      register a payout address.
   *
   * PRIVACY: only creator-owned data is touched here — a CreatorId and the public
   * address that creator chose to be paid at. No fan identity is read or derived.
   */
  private resolveCreatorPayoutAddress(creatorId: string): `0x${string}` {
    const registered = this.resolveCreatorAddress?.(creatorId);
    if (registered) {
      // Defence in depth: the store should only ever hold validated addresses
      // (the route validates before storing), but re-check at the network edge.
      if (!isAddress(registered)) {
        throw new Error(
          `RealCircleSettlement.resolveCreatorPayoutAddress: registered payout ` +
            `address for creator "${creatorId}" is not a valid 0x address: ` +
            `"${registered}".`,
        );
      }
      return registered;
    }

    // Fallback: creatorId itself is already an on-chain address (legacy demo).
    if (isAddress(creatorId)) return creatorId as `0x${string}`;

    throw new Error(
      `RealCircleSettlement.resolveCreatorPayoutAddress: creator "${creatorId}" ` +
        `has no registered payout address and is not itself a 0x address. ` +
        `Register one via POST /api/creator/:creatorId/payout-address before settling.`,
    );
  }

  /**
   * Submit ONE aggregated settlement to Circle Gateway.
   *
   * CONFIRMED: the Gateway exposes a REST API at this host (the balances endpoint
   * `${gatewayBase}/v1/balances` is used verbatim by the reference). CONFIRMED:
   * the off-chain authorizations are settled on the SELLER side via
   * `BatchFacilitatorClient.settle(paymentPayload, requirements)` where the
   * `requirements.extra` is { name:"GatewayWalletBatched", version:"1",
   * verifyingContract: <Gateway Wallet> } (arc-nanopayments lib/x402.ts:45-62,
   * :126).
   *
   * ASSUMED / TODO(DevRel): the exact REST route + JSON body to submit a
   * facilitator settlement WITHOUT the SDK is NOT shown in the reference (the demo
   * only ever calls it through BatchFacilitatorClient). The block below documents
   * the request we believe is needed and is intentionally left throwing so we
   * never emit an unverified payload and pretend it settled. Two ways to finish:
   *
   *   (A) Preferred once package.json can include it: import
   *       `BatchFacilitatorClient` from "@circle-fin/x402-batching/server" and call
   *       `.settle(payload, requirements)`; map its `transaction` -> txRef.
   *   (B) Pure-REST: POST the facilitator settle request to the Gateway. Confirm
   *       with DevRel: exact path (e.g. POST `${gatewayBase}/v1/x402/settle`?),
   *       auth header (Bearer cfg.circleApiKey?), and whether a single aggregated
   *       creator settlement is one call or requires the per-auth payloads.
   */
  private async submitGatewaySettlement(args: {
    payTo: `0x${string}`;
    amountAtomic: bigint;
    network: string;
  }): Promise<string> {
    // Build the payment-requirements object exactly as the reference does for the
    // Gateway-batching scheme (CONFIRMED fields; the verifyingContract is the Arc
    // testnet Gateway Wallet from lib/x402.ts:26). For mainnet, CONFIRM the
    // Gateway Wallet address with DevRel.
    const requirements = {
      scheme: "exact" as const,
      network: args.network,
      asset: this.usdc,
      amount: args.amountAtomic.toString(),
      payTo: args.payTo,
      // 4 days, matching the reference (lib/x402.ts:55).
      maxTimeoutSeconds: 345_600,
      extra: {
        name: "GatewayWalletBatched",
        version: "1",
        // ASSUMED for non-testnet; CONFIRMED for testnet (lib/x402.ts:26).
        verifyingContract: "0x0077777d7EBA4688BDeF3E311b846F25870A19B9",
      },
    } as const;

    // Authenticated Gateway REST call would look like the following. Endpoint and
    // body are UNCONFIRMED — see TODO(DevRel) above. Do NOT enable until verified.
    //
    //   const res = await fetch(`${this.gatewayBase}/v1/x402/settle`, {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Authorization: `Bearer ${this.cfg.circleApiKey}`,
    //     },
    //     body: JSON.stringify({ requirements /*, payload(s)? */ }),
    //   });
    //   if (!res.ok) throw new Error(`Gateway settle failed: ${res.status} ${await res.text()}`);
    //   const data = await res.json();
    //   return data.transaction as string; // on-chain tx hash / settlement id
    //
    // Reference these so they aren't reported as unused while the call is gated,
    // and so the intended inputs are explicit:
    void requirements;
    void this.cfg.circleApiKey;
    void this.gatewayBase;

    throw new Error(
      "RealCircleSettlement.submitGatewaySettlement: the Gateway batch-settlement " +
        "endpoint/payload is not yet confirmed (the arc-nanopayments reference only " +
        "drives it via BatchFacilitatorClient from @circle-fin/x402-batching/server, " +
        "which is not a dependency of this server). Either (A) add that SDK and call " +
        "facilitator.settle(payload, requirements), or (B) confirm the REST route + " +
        "auth with Circle DevRel and enable the fetch() above. See TODO(DevRel).",
    );
  }

  /**
   * Read the settler's Gateway USDC balance via the CONFIRMED public REST endpoint
   * (arc-nanopayments app/api/gateway/balance/route.ts). Not on the port; provided
   * for the GO LIVE smoke check / dashboard. Reads only the settler's own address
   * (depositor) — no fan data.
   */
  async gatewayBalance(): Promise<{ available: string; raw: unknown }> {
    const res = await fetch(`${this.gatewayBase}/v1/balances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // NOTE: the reference (Next.js) passes `cache: "no-store"` here; that field
      // is a Next/undici extension not present in this project's fetch types, so
      // it is omitted. Add it back if/when running under a runtime that types it.
      body: JSON.stringify({
        token: "USDC",
        sources: [{ domain: ARC_GATEWAY_DOMAIN, depositor: this.account.address }],
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Gateway balances failed: ${res.status} ${await res.text()}`,
      );
    }
    const data = (await res.json()) as {
      balances?: Array<{ domain: number; balance?: string }>;
    };
    const bal = data.balances?.find((b) => b.domain === ARC_GATEWAY_DOMAIN);
    return { available: bal?.balance ?? "0", raw: data };
  }
}

/* ============================================================================
 * GO LIVE CHECKLIST (what's needed to flip MOCK=false and settle for real)
 * ----------------------------------------------------------------------------
 * ENV (src/config.ts already reads these; assertRealConfig enforces them):
 *   ARC_RPC_URL          = https://rpc.testnet.arc.network            (CONFIRMED)
 *   USDC_ADDRESS         = 0x3600000000000000000000000000000000000000 (CONFIRMED testnet)
 *   CIRCLE_GATEWAY_URL   = https://gateway-api-testnet.circle.com     (CONFIRMED testnet host)
 *   CIRCLE_API_KEY       = <Circle API key>                           (NEEDED — none yet)
 *   SETTLER_PRIVATE_KEY  = 0x...  (settler wallet; fund with USDC + native gas on Arc)
 *   CHAIN_ENV            = arc-testnet
 *
 * CODE TODOs (in this file):
 *   1. submitGatewaySettlement(): confirm the Gateway batch-settlement path —
 *      either add `@circle-fin/x402-batching` (sibling owns package.json) and call
 *      BatchFacilitatorClient.settle(), or enable the REST fetch() once DevRel
 *      confirms route + auth. This is the ONLY blocker on real settlement.
 *   2. resolveCreatorPayoutAddress(): DONE (TASK 1). A creator->address lookup is
 *      now injected from the store (Store.getCreatorPayoutAddress) via the adapter
 *      factory; creators register an address via POST
 *      /api/creator/:creatorId/payout-address. Creator-only; no fan data. The
 *      legacy "creatorId IS an address" path is kept as a fallback.
 *   3. Arc MAINNET: swap the viem `chain`, USDC address, Gateway Wallet, and CCTP
 *      domain for mainnet values (CONFIRM all four with DevRel).
 *
 * The withdraw() path is already a real, working same-chain USDC transfer on Arc.
 * ============================================================================ */
