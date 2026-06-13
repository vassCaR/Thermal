/**
 * Environment configuration.
 *
 * Everything external is behind a config flag so we can run a convincing demo
 * in MOCK mode with zero keys, then flip to real integrations by setting env.
 */

function envStr(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function envInt(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v.toLowerCase() === "true" || v === "1";
}

export interface Config {
  /** Master switch. true => mock adapters (default). false => real adapters. */
  mock: boolean;
  port: number;
  host: string;
  /** Per-creator aggregation window before a settlement is attempted. */
  batchIntervalMs: number;
  /** Comma-separated allowed origins, or "*" for permissive (demo default). */
  corsOrigins: string;

  // --- Arc / Circle ---
  arcRpcUrl: string;
  circleApiKey: string;
  circleGatewayUrl: string;
  usdcAddress: string;
  settlerPrivateKey: string;
  /** Logical chain/environment tag forwarded to adapters (e.g. "arc-testnet"). */
  chainEnv: string;

  // --- Unlink ---
  unlinkApiKey: string;
  /** Unlink environment string. CONFIRM exact value for Arc with Unlink DevRel. */
  unlinkEnv: string;
  /** Unlink engine/API base URL used by the admin client. */
  unlinkEngineUrl: string;
}

export function loadConfig(): Config {
  const mock = envBool("MOCK", true);
  return {
    mock,
    port: envInt("PORT", 8787),
    host: envStr("HOST", "0.0.0.0"),
    batchIntervalMs: envInt("BATCH_INTERVAL_MS", 4000),
    corsOrigins: envStr("CORS_ORIGINS", "*"),

    arcRpcUrl: envStr("ARC_RPC_URL", "https://rpc.testnet.arc.network"),
    circleApiKey: envStr("CIRCLE_API_KEY", ""),
    circleGatewayUrl: envStr("CIRCLE_GATEWAY_URL", ""),
    usdcAddress: envStr("USDC_ADDRESS", ""),
    settlerPrivateKey: envStr("SETTLER_PRIVATE_KEY", ""),
    chainEnv: envStr("CHAIN_ENV", "arc-testnet"),

    unlinkApiKey: envStr("UNLINK_API_KEY", ""),
    unlinkEnv: envStr("UNLINK_ENV", "testnet"),
    unlinkEngineUrl: envStr("UNLINK_ENGINE_URL", ""),
  };
}

/** Throws if real mode is requested but required keys are missing. Fail fast. */
export function assertRealConfig(c: Config): void {
  if (c.mock) return;
  const missing: string[] = [];
  if (!c.unlinkApiKey) missing.push("UNLINK_API_KEY");
  if (!c.unlinkEngineUrl) missing.push("UNLINK_ENGINE_URL");
  if (!c.circleApiKey) missing.push("CIRCLE_API_KEY");
  if (!c.circleGatewayUrl) missing.push("CIRCLE_GATEWAY_URL");
  if (!c.usdcAddress) missing.push("USDC_ADDRESS");
  if (!c.settlerPrivateKey) missing.push("SETTLER_PRIVATE_KEY");
  if (!c.arcRpcUrl) missing.push("ARC_RPC_URL");
  if (missing.length > 0) {
    throw new Error(
      `MOCK=false but these env vars are missing: ${missing.join(", ")}. ` +
        `Set them in .env or run with MOCK=true.`,
    );
  }
}
