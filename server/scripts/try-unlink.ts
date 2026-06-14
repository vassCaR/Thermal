/**
 * Throwaway probe: register a REAL Unlink account against the hosted engine
 * using the keys in .env, with Circle kept mocked. Does NOT start the server or
 * touch the running demo. Run: npx tsx scripts/try-unlink.ts
 */
import { loadEnvFile } from "../src/env.js";
import { loadConfig } from "../src/config.js";
import { buildAdapters } from "../src/adapters/index.js";

loadEnvFile();
const cfg = { ...loadConfig(), mockUnlink: false, mockCircle: true };
console.log("env:", cfg.unlinkEnv, "| engineUrl set:", Boolean(cfg.unlinkEngineUrl), "| apiKey set:", Boolean(cfg.unlinkApiKey));

const adapters = buildAdapters(cfg);
console.log("unlink adapter kind:", adapters.unlink.kind);

const reg = await adapters.unlink.registerFan({
  dynamicAddress: "0x0000000000000000000000000000000000000001",
});
console.log("REGISTERED fanAccountId:", reg.fanAccountId);

const tok = await adapters.unlink.issueAuthToken({ fanAccountId: reg.fanAccountId });
console.log("AUTH TOKEN:", tok.token.slice(0, 14) + "…", "expiresAt:", new Date(tok.expiresAt).toISOString());
console.log("OK — real Unlink account + auth token issued.");
