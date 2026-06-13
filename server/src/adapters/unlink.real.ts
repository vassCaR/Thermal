/**
 * RealUnlinkAdmin — REAL adapter (used when MOCK=false).
 *
 * ============================================================================
 * VERIFIED PUBLISHED SURFACE — `@unlink-xyz/sdk` (inspected from the tarball,
 * NOT from the docs). Two dist-tags are published:
 *   - `latest` -> 0.0.2-canary.0   (stale April-2026 cut; only exports ".")
 *   - `canary` -> 0.3.0-canary.598 (current, updated 2026-06-11; THIS is ours)
 *
 * We pin `0.3.0-canary.598` in package.json. Its `package.json#exports` ships:
 *   "./admin", "./client", "./browser", "./react", "./crypto", "./advanced".
 *
 * => The docs' `@unlink-xyz/sdk/admin` subpath IS real on the canary line. (The
 *    old stub said it was missing; that was only true of the stale `latest`
 *    tag. Confirmed present in 0.3.0-canary.598's dist/admin/index.d.ts.)
 *
 * What `@unlink-xyz/sdk/admin` actually exports (CONFIRMED, verbatim shapes):
 *   createUnlinkAdmin(options): UnlinkAdmin
 *     options = {
 *       environment?: EnvironmentName | string,   // resolved to an Engine URL
 *       engineUrl?: string,                       // escape hatch (provide ONE)
 *       apiKey: string,
 *       customFetch?: typeof fetch,
 *       dangerouslyAllowBrowser?: boolean,        // keep false on the server
 *     }
 *   admin.users.register(payload: RegistrationPayload | RegistrationPayloadWire)
 *       -> Promise<{ address: string; index: number }>           // idempotent
 *   admin.authorizationTokens.issue(params: IssueAuthorizationTokenParams)
 *       -> Promise<{ token: string; expiresAt: Date }>           // <=900s TTL
 *   admin.environment() -> Promise<EnvironmentInfo>
 *   admin.getApiClient() -> raw openapi-fetch client (advanced)
 *
 *   IssueAuthorizationTokenParams (the `unlink_address` arm we use):
 *     { subjectType?: "unlink_address"; unlinkAddress: string;
 *       expiresInSeconds?: number /* (0, 900], default 900 *\/ }
 *
 *   ENVIRONMENTS (from dist) — Arc IS a first-class hosted env:
 *     "arc-testnet" -> https://arc-testnet-production-api.unlink.xyz
 *     (also base / base-sepolia / ethereum-sepolia / monad / monad-testnet)
 *   => This answers config.ts's "CONFIRM exact Arc value": use "arc-testnet".
 *
 * ----------------------------------------------------------------------------
 * THE ONE REAL GAP (registerFan key material) — see registerFan() below.
 * `admin.users.register()` does NOT take an EVM address. It takes a
 * RegistrationPayload derived from the fan's Unlink AccountKeys:
 *     { address, spendingPublicKey:[bigint,bigint], viewingPrivateKey:Uint8Array,
 *       nullifyingKey:bigint }   (the spending PRIVATE key is never in it).
 * Those keys are derived from a SECRET (an EOA `personal_sign` signature, a
 * seed, or a mnemonic) via `@unlink-xyz/sdk/crypto`'s `account.*`. A bare
 * `dynamicAddress` is public and carries no secret, so the server cannot
 * synthesise a private account from it alone. Resolved per the privacy model:
 * the CLIENT derives keys from the Dynamic wallet and hands the server the
 * JSON-safe `RegistrationPayloadWire`; the server only relays it to Engine.
 * Until the port carries that payload, registration is gated (see TODO).
 * ============================================================================
 */
// Type-only import: ERASED at runtime, so MOCK mode never loads the Unlink SDK
// (or its transitive deps like openapi-fetch). The real client is imported
// dynamically in getAdmin(), only when a real method is actually called.
import type { UnlinkAdmin } from "@unlink-xyz/sdk/admin";

import type { Config } from "../config.js";
import type {
  IssueAuthTokenInput,
  IssueAuthTokenResult,
  RegisterFanInput,
  RegisterFanResult,
  UnlinkAdminPort,
} from "../ports/unlink.js";

export class RealUnlinkAdmin implements UnlinkAdminPort {
  readonly kind = "real" as const;

  /** Lazily-constructed control-plane handle (built on first real use). */
  private adminInstance?: UnlinkAdmin;

  constructor(private readonly cfg: Config) {}

  /**
   * Build (once) and return the Unlink admin client. The SDK is imported
   * DYNAMICALLY here so MOCK mode never loads it: adapters/index.ts statically
   * references this class, and a top-level SDK import would crash the whole
   * server (incl. mock) when the SDK or its transitive deps are absent.
   */
  private async getAdmin(): Promise<UnlinkAdmin> {
    if (!this.adminInstance) {
      const { createUnlinkAdmin } = await import("@unlink-xyz/sdk/admin");
      // Provide EXACTLY ONE connection target. Prefer the explicit engine URL
      // when set; otherwise resolve the named hosted env. For Arc, cfg.unlinkEnv
      // should be "arc-testnet" (verified in ENVIRONMENTS).
      const connection = this.cfg.unlinkEngineUrl
        ? { engineUrl: this.cfg.unlinkEngineUrl }
        : { environment: this.cfg.unlinkEnv };
      this.adminInstance = createUnlinkAdmin({
        ...connection,
        apiKey: this.cfg.unlinkApiKey,
        dangerouslyAllowBrowser: false,
      });
    }
    return this.adminInstance;
  }

  /**
   * Register a fan's PRIVATE Unlink account and return an opaque id.
   *
   * Returned id == the fan's bech32m Unlink address. It is unlinkable to the
   * Dynamic EVM address (different keyspace, derived from a secret), so it
   * satisfies the port's "MUST NOT reveal the real address" contract.
   *
   * GATED: `admin.users.register(payload)` needs a `RegistrationPayload`
   * (spendingPublicKey / viewingPrivateKey / nullifyingKey) derived from the
   * fan's SECRET. `RegisterFanInput` only carries `dynamicAddress` (public), so
   * we cannot mint real key material here. The intended (privacy-preserving)
   * flow is client-derived, server-relayed:
   *
   *   // CLIENT (web app, with the Dynamic wallet):
   *   import { account } from "@unlink-xyz/sdk/crypto";
   *   const sig = await wallet.signMessage(
   *     buildDeriveSeedMessage({ appId, chainId }));      // EIP-191
   *   const acct = account.fromEthereumSignature({ signature: sig, appId, chainId });
   *   const wire = toRegistrationPayloadWire(await account.toRegistrationPayload(acct));
   *   // POST `wire` to this server.
   *
   *   // SERVER (here), once RegisterFanInput carries that wire payload:
   *   const { address } = await this.admin.users.register(wire); // idempotent
   *   return { fanAccountId: address };
   *
   * See the DevRel questions in the return notes for the exact contract change.
   */
  async registerFan(_input: RegisterFanInput): Promise<RegisterFanResult> {
    // TODO(go-live): thread the client-derived RegistrationPayloadWire through
    // UnlinkAdminPort.registerFan (it currently only carries `dynamicAddress`),
    // then call `this.admin.users.register(wire)` and return its `address`.
    // (Alternative if Unlink confirms server-custody is acceptable for the demo:
    //  derive keys from a per-fan seed via `account.fromSeed(...)` in
    //  @unlink-xyz/sdk/crypto, build the payload with `toRegistrationPayload`,
    //  then register. Avoided here: it custodies the fan's spending key and
    //  weakens the "nobody can link fan->creator" guarantee.)
    throw new Error(
      "RealUnlinkAdmin.registerFan is gated: admin.users.register() needs a " +
        "client-derived RegistrationPayload, but RegisterFanInput only carries " +
        "dynamicAddress. Wire the payload through the port (see TODO), or run " +
        "MOCK=true. The Unlink admin client itself is fully constructed.",
    );
  }

  /**
   * Issue a short-lived authorization token the FRONTEND uses to perform a
   * private transfer on the fan's behalf. Fully wired against the real API.
   *
   * `fanAccountId` is the bech32m Unlink address returned by registerFan().
   * `creatorId` is intentionally NOT forwarded: the token is scoped to the
   * fan's address only, so the issued credential never encodes who the fan
   * supports (preserves fan->creator unlinkability). It stays in the port for
   * future server-side rate-limiting/telemetry that must not leak the link.
   */
  async issueAuthToken(input: IssueAuthTokenInput): Promise<IssueAuthTokenResult> {
    const admin = await this.getAdmin();
    const { token, expiresAt } = await admin.authorizationTokens.issue({
      subjectType: "unlink_address",
      unlinkAddress: input.fanAccountId,
      // Default is the backend max (900s). A tight TTL fits per-second tipping;
      // the client refreshes before expiry. Leave unset to take the 900s default,
      // or set e.g. expiresInSeconds: 300 once we tune the client refresh loop.
      // expiresInSeconds: 300,
    });

    // Port contract is epoch ms; the SDK returns a parsed Date. (No-op marker to
    // surface intent if the unused-param lint ever flags creatorId.)
    void input.creatorId;
    return { token, expiresAt: expiresAt.getTime() };
  }
}
