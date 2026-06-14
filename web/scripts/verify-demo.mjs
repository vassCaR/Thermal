// One-off e2e verification of the live Thermal demo on :3001.
// Drives a real headless browser: navbar, branding, amount selector + Support.
import { chromium } from "playwright";

const BASE = process.env.WEB_URL ?? "http://localhost:3001";
const fail = (m) => {
  console.error("FAIL:", m);
  process.exitCode = 1;
};

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e.message)));
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

await page.goto(BASE, { waitUntil: "networkidle" });

// --- §1 navbar ---
const wordmarks = await page.getByText("Thermal", { exact: true }).count();
console.log("Thermal wordmarks on page:", wordmarks);
if (!(await page.getByRole("button", { name: /connect wallet/i }).isVisible()))
  fail("Connect Wallet not visible in top bar");
if (!(await page.getByRole("link", { name: /about us/i }).first().isVisible()))
  fail("About us link missing");
if (!(await page.getByRole("link", { name: /how it works/i }).first().isVisible()))
  fail("How it works link missing");

// --- §2 branding: no Ghost logo placeholder ---
const ghostImgs = await page.locator('img[alt="Ghost"]').count();
console.log("Ghost logo placeholders:", ghostImgs);
if (ghostImgs > 0) fail(`${ghostImgs} Ghost logo placeholder(s) still rendered`);

// --- hero ---
if (!(await page.getByRole("heading", { name: "Thermal" }).isVisible()))
  fail("Hero THERMAL heading missing");

// --- §4 amount selector + support ---
const totalBefore = (await page.getByTestId("supported-total").textContent())?.trim();
console.log("supported-total before:", totalBefore);
await page.getByTestId("amount-5.00").click();
await page.getByTestId("support-creators").click();
await page
  .getByTestId("supported-total")
  .filter({ hasNotText: "0.000000" })
  .waitFor({ timeout: 10000 })
  .catch(() => fail("supported-total did not update after Support click"));
const totalAfter = (await page.getByTestId("supported-total").textContent())?.trim();
console.log("supported-total after:", totalAfter);
if (totalAfter === totalBefore) fail("total unchanged after support");

// custom amount
await page.getByTestId("amount-custom").fill("2.50");
await page.getByTestId("support-creators").click();
await page.waitForTimeout(1500);
const totalAfter2 = (await page.getByTestId("supported-total").textContent())?.trim();
console.log("supported-total after custom 2.50:", totalAfter2);
if (totalAfter2 === totalAfter) fail("total unchanged after custom support");

await page.screenshot({ path: "/tmp/thermal-demo.png", fullPage: false });
console.log("screenshot -> /tmp/thermal-demo.png");
console.log("console errors:", consoleErrors.length ? consoleErrors : "none");
if (consoleErrors.length) fail("console errors present");

await browser.close();
console.log(process.exitCode ? "RESULT: FAILED" : "RESULT: PASS");
