/**
 * Ghost Tips server entry point.
 *
 * Reads .env (if present) without a hard dependency: Node 22 supports
 * `node --env-file=.env`, and `tsx`/`npm run dev` can be invoked with it. We
 * also load .env manually below so `npm start` works without extra flags.
 */
import { buildApp } from "./app.js";
import { loadEnvFile } from "./env.js";

async function main(): Promise<void> {
  loadEnvFile(); // best-effort .env loader (no external dep)

  const { app, cfg, batcher } = await buildApp();
  batcher.start();

  try {
    await app.listen({ port: cfg.port, host: cfg.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "shutting down");
    await batcher.stop(); // final drain of pending settlements
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
