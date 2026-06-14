/**
 * VERIFY test (TASK 2c).
 *
 * Covers the two checks in src/verify.ts:
 *   - verifyPresence: rejects empty / malformed signatures, accepts well-formed
 *     hex. This is the mock-mode gate (we can't map fanAccountId -> address, so
 *     we only require a present, well-shaped signature).
 *   - verifyAgainstAddress: full EIP-191 recovery. We sign a real tip message
 *     with a viem test private key (using the SAME tipMessageToSign the server
 *     uses), then assert recovery accepts the correct address and rejects a wrong
 *     expected address.
 *
 * Run with: npm test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { privateKeyToAccount } from "viem/accounts";
import { tipMessageToSign, type TipAuthorization } from "../src/contract.js";
import { verifyPresence, verifyAgainstAddress } from "../src/verify.js";

// A well-known viem test private key (Anvil/Hardhat account #0). Test-only.
const TEST_PK =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account = privateKeyToAccount(TEST_PK);

function baseAuth(overrides: Partial<TipAuthorization> = {}): TipAuthorization {
  return {
    fanAccountId: "ghostfan_abc123",
    creatorId: "ghost:alice",
    amount: "0.002000",
    nonce: 1,
    ts: 1_700_000_000_000,
    signature: "0x" + "a".repeat(130),
    ...overrides,
  };
}

test("verifyPresence: rejects missing signature", () => {
  const r = verifyPresence(baseAuth({ signature: "" }));
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /missing signature/);
});

test("verifyPresence: rejects non-hex / malformed signature", () => {
  const notHex = verifyPresence(baseAuth({ signature: "deadbeef" })); // no 0x prefix
  assert.equal(notHex.ok, false);
  assert.match(notHex.reason ?? "", /malformed signature/);

  const tooShort = verifyPresence(baseAuth({ signature: "0x" })); // length < 4
  assert.equal(tooShort.ok, false);
  assert.match(tooShort.reason ?? "", /malformed signature/);
});

test("verifyPresence: accepts well-formed hex signature", () => {
  const r = verifyPresence(baseAuth({ signature: "0x" + "a".repeat(130) }));
  assert.equal(r.ok, true);
});

test("verifyAgainstAddress: accepts a real EIP-191 signature from the right signer", async () => {
  const payload = {
    fanAccountId: "ghostfan_real",
    creatorId: "ghost:alice",
    amount: "0.002000",
    nonce: 7,
    ts: 1_700_000_000_123,
  };
  const message = tipMessageToSign(payload);
  const signature = await account.signMessage({ message });

  const auth: TipAuthorization = { ...payload, signature };

  const ok = await verifyAgainstAddress(auth, account.address);
  assert.equal(ok.ok, true, ok.reason);
});

test("verifyAgainstAddress: rejects a wrong expected address", async () => {
  const payload = {
    fanAccountId: "ghostfan_real",
    creatorId: "ghost:alice",
    amount: "0.002000",
    nonce: 8,
    ts: 1_700_000_000_456,
  };
  const message = tipMessageToSign(payload);
  const signature = await account.signMessage({ message });
  const auth: TipAuthorization = { ...payload, signature };

  const wrongAddress = "0x000000000000000000000000000000000000dEaD";
  const res = await verifyAgainstAddress(auth, wrongAddress);
  assert.equal(res.ok, false);
  assert.match(res.reason ?? "", /does not match/);
});

test("verifyAgainstAddress: rejects a signature over a tampered payload", async () => {
  // Sign one payload, then verify against an auth whose amount was altered. The
  // recovered signer won't match because the message changed -> recovery yields a
  // different address than expected.
  const payload = {
    fanAccountId: "ghostfan_real",
    creatorId: "ghost:alice",
    amount: "0.002000",
    nonce: 9,
    ts: 1_700_000_000_789,
  };
  const signature = await account.signMessage({ message: tipMessageToSign(payload) });
  const tampered: TipAuthorization = { ...payload, amount: "9.000000", signature };

  const res = await verifyAgainstAddress(tampered, account.address);
  assert.equal(res.ok, false, "tampered amount must fail recovery match");
});
