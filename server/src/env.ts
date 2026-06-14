/**
 * Minimal .env loader (no external dependency).
 *
 * Reads /server/.env if it exists and sets any keys that aren't already in
 * process.env. Real env vars always win. Good enough for a hackathon; swap for
 * `dotenv` or `node --env-file` if you prefer.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnvFile(explicitPath?: string): void {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/ at dev time, dist/server/src/ after build -> ../.. lands on /server.
  const path = explicitPath ?? resolve(here, "..", ".env");
  if (!existsSync(path)) return;

  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip an inline comment when the value isn't quoted. Handles both a
    // trailing " # comment" AND a value that is ONLY a comment (placeholder line
    // like `KEY=   # describe me` -> empty, not the comment text).
    if (!/^["']/.test(value)) {
      if (value.startsWith("#")) {
        value = "";
      } else {
        const hash = value.indexOf(" #");
        if (hash !== -1) value = value.slice(0, hash).trim();
      }
    }
    // Strip surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
