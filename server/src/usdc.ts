/**
 * USDC amount helpers.
 *
 * The shared contract types USDC as a string with exactly 6 decimals
 * (e.g. "0.002000") and says: never use floats. We therefore do ALL arithmetic
 * in BigInt micro-units (1 USDC = 1_000_000 micro) and only format to a
 * 6-decimal string at the edges.
 */
import type { Usdc } from "./contract.js";

export const USDC_DECIMALS = 6;
const SCALE = 1_000_000n; // 10 ** 6

/** Parse a USDC string into BigInt micro-units. Throws on malformed input. */
export function parseUsdc(value: Usdc): bigint {
  if (typeof value !== "string") {
    throw new Error(`USDC amount must be a string, got ${typeof value}`);
  }
  const trimmed = value.trim();
  // Length cap before the regex/BigInt: avoids a CPU-DoS from a huge all-digit string.
  if (trimmed.length > 30) {
    throw new Error("USDC amount is too long");
  }
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`Invalid USDC amount: "${value}" (expected up to 6 decimals)`);
  }
  const [intPart, fracPartRaw = ""] = trimmed.split(".");
  const fracPart = fracPartRaw.padEnd(USDC_DECIMALS, "0");
  return BigInt(intPart) * SCALE + BigInt(fracPart || "0");
}

/** Format BigInt micro-units back to a canonical 6-decimal USDC string. */
export function formatUsdc(micro: bigint): Usdc {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const intPart = abs / SCALE;
  const fracPart = (abs % SCALE).toString().padStart(USDC_DECIMALS, "0");
  return `${neg ? "-" : ""}${intPart.toString()}.${fracPart}`;
}

export const ZERO_USDC: Usdc = formatUsdc(0n);

export function addUsdc(a: Usdc, b: Usdc): Usdc {
  return formatUsdc(parseUsdc(a) + parseUsdc(b));
}

export function subUsdc(a: Usdc, b: Usdc): Usdc {
  return formatUsdc(parseUsdc(a) - parseUsdc(b));
}

export function gteUsdc(a: Usdc, b: Usdc): boolean {
  return parseUsdc(a) >= parseUsdc(b);
}

export function isPositiveUsdc(a: Usdc): boolean {
  return parseUsdc(a) > 0n;
}
