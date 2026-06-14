// One-off e2e verification of the live Thermal demo on :3001 (V2).
// Covers: top bar (links/badge), wallet dropdown (downward + scrollable, short
// viewport), Run Demo scripted flow, manual support regression, overflow/console.
import { chromium } from "playwright";

const BASE = process.env.WEB_URL ?? "http://localhost:3001";
let failed = false;
const fail = (m) => {
  console.error("FAIL:", m);
  failed = true;
};
const ok = (m) => console.log("ok:", m);

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e.message)));
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });

// ---- §2 top bar ----
for (const [name, sel] of [
  ["About us link", page.getByRole("link", { name: /about us/i })],
  ["How it works link", page.getByRole("link", { name: /how it works/i })],
  ["Connect Wallet", page.getByRole("button", { name: /connect wallet/i })],
]) {
  (await sel.first().isVisible()) ? ok(name) : fail(`${name} missing`);
}
const docs = page.getByRole("link", { name: /^docs$/i });
if (await docs.isVisible()) {
  const href = await docs.getAttribute("href");
  href && href.includes("github.com") ? ok(`Docs -> ${href}`) : fail(`Docs href not github: ${href}`);
} else fail("Docs link missing");
(await page.getByText(/arc testnet/i).first().isVisible())
  ? ok("Arc Testnet badge")
  : fail("Arc Testnet badge missing");

// ---- §2 no horizontal overflow ----
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
overflow <= 1 ? ok("no horizontal overflow") : fail(`horizontal overflow: ${overflow}px`);

// ---- §3 demo badge ----
(await page.getByTestId("demo-badge").isVisible())
  ? ok("DEMO badge visible")
  : fail("DEMO badge missing");

// ---- §3 Run Demo scripted flow ----
await page.getByTestId("run-demo").click();
await page
  .getByTestId("demo-step")
  .filter({ hasText: /complete/i })
  .waitFor({ timeout: 20000 })
  .then(() => ok("Run Demo completed"))
  .catch(() => fail("Run Demo did not complete"));
const afterDemo = (await page.getByTestId("supported-total").textContent())?.trim();
console.log("total after demo:", afterDemo);
afterDemo && !afterDemo.startsWith("0.000000") ? ok("total updated by demo") : fail("demo total stuck at 0");

// replay once
await page.getByTestId("run-demo").click();
await page.getByTestId("demo-step").filter({ hasText: /complete/i }).waitFor({ timeout: 20000 })
  .then(() => ok("Run Demo replayable")).catch(() => fail("Run Demo not replayable"));
const afterReplay = (await page.getByTestId("supported-total").textContent())?.trim();
afterReplay !== afterDemo ? ok(`total climbed on replay (${afterReplay})`) : fail("total unchanged on replay");

// ---- regression: manual amount -> support ----
const before = (await page.getByTestId("supported-total").textContent())?.trim();
await page.getByTestId("amount-5.00").click();
await page.getByTestId("support-creators").click();
await page.waitForTimeout(1500);
const after = (await page.getByTestId("supported-total").textContent())?.trim();
after !== before ? ok(`manual support works (${before} -> ${after})`) : fail("manual support regression");

// ---- §1 wallet dropdown on a SHORT viewport (the original bug condition) ----
await page.setViewportSize({ width: 1280, height: 560 });
const trigger = page.getByTestId("connect-wallet");
await trigger.click();
const menu = page.getByRole("menu", { name: /connect a wallet/i });
await menu.waitFor({ timeout: 5000 }).catch(() => fail("wallet menu did not open"));
const tBox = await trigger.boundingBox();
const mBox = await menu.boundingBox();
if (tBox && mBox) {
  mBox.y >= tBox.y + tBox.height - 4 ? ok("menu opens downward (below trigger)") : fail(`menu opens upward: menu.y=${mBox.y} trigger.bottom=${tBox.y + tBox.height}`);
  mBox.y >= 0 ? ok("menu top not clipped above viewport") : fail(`menu clipped at top: y=${mBox.y}`);
  mBox.y + mBox.height <= 560 + 1 ? ok("menu fits within viewport height") : fail(`menu overflows bottom: ${mBox.y + mBox.height}`);
}
// all five wallets reachable (scroll the last into view, then click it)
for (const id of ["metamask", "brave", "rabby", "coinbase", "walletconnect"]) {
  const w = page.getByTestId(`wallet-${id}`);
  (await w.count()) ? null : fail(`wallet ${id} not rendered`);
}
const last = page.getByTestId("wallet-walletconnect");
await last.scrollIntoViewIfNeeded();
await last.click();
(await page.getByTestId("wallet-connected").isVisible())
  ? ok("wallet selectable -> connected")
  : fail("wallet selection did not connect");

await page.setViewportSize({ width: 1280, height: 800 });
await page.screenshot({ path: "/tmp/thermal-demo-v2.png", fullPage: false });

console.log("console errors:", consoleErrors.length ? consoleErrors : "none");
if (consoleErrors.length) fail("console errors present");

await browser.close();
console.log(failed ? "RESULT: FAILED" : "RESULT: PASS");
process.exit(failed ? 1 : 0);
