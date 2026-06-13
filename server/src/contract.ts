/**
 * Re-export of the FROZEN shared API contract.
 *
 * The single source of truth is /shared/api.ts. We never redefine these types
 * here — we only re-export them so the rest of the server imports from one place
 * ("./contract.js") instead of reaching across the repo root everywhere.
 *
 * If you need to change a signature, change /shared/api.ts and tell the /web dev.
 */
export * from "../../shared/api.js";
