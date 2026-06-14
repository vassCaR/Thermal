/**
 * Fastify app builder. Wires config -> adapters -> store -> batcher -> routes.
 * Kept separate from index.ts so it can be imported by the smoke test.
 */
import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { buildAdapters } from "./adapters/index.js";
import { Batcher } from "./batcher.js";
import { assertRealConfig, loadConfig, type Config } from "./config.js";
import { registerRoutes } from "./routes.js";
import { Store } from "./store.js";

export interface BuiltApp {
  app: FastifyInstance;
  cfg: Config;
  batcher: Batcher;
  store: Store;
}

export async function buildApp(overrides?: Partial<Config>): Promise<BuiltApp> {
  const cfg = { ...loadConfig(), ...overrides };
  assertRealConfig(cfg); // fail fast if MOCK=false without keys

  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
    },
  });

  // Permissive CORS so the Next.js front (localhost:3000) can call us.
  await app.register(cors, {
    origin: cfg.corsOrigins === "*" ? true : cfg.corsOrigins.split(",").map((s) => s.trim()),
    methods: ["GET", "POST", "OPTIONS"],
  });

  const store = new Store();
  // Thread the creator-only payout-address lookup into the adapters. The real
  // Circle adapter uses it to resolve creatorId -> on-chain payout address at
  // settle time (TASK 1). PRIVACY: this resolver returns creator-owned data only;
  // it has no access to and never derives any fan identity.
  const adapters = buildAdapters(cfg, (creatorId) =>
    store.getCreatorPayoutAddress(creatorId),
  );
  const batcher = new Batcher(adapters.circle, store, cfg.batchIntervalMs, {
    onSettled: (info) =>
      app.log.info(
        { creatorId: info.creatorId, txRef: info.txRef, total: info.total, items: info.itemCount },
        "batch settled",
      ),
    onError: (info) => app.log.error({ creatorId: info.creatorId, err: info.error }, "settle failed"),
  });

  registerRoutes(app, { cfg, store, adapters, batcher });

  // Global error handler: keep 4xx messages, but never leak internal 5xx detail
  // (real-mode adapter throws would otherwise surface as raw 500 bodies).
  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error({ err }, "unhandled error");
    const code =
      typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500
        ? err.statusCode
        : 500;
    reply.code(code).send({ error: code === 500 ? "Internal error" : err.message });
  });

  app.log.info(
    {
      mock: cfg.mock,
      unlink: adapters.unlink.kind,
      circle: adapters.circle.kind,
      chainEnv: cfg.chainEnv,
      batchIntervalMs: cfg.batchIntervalMs,
    },
    "Ghost Tips server configured",
  );

  return { app, cfg, batcher, store };
}
