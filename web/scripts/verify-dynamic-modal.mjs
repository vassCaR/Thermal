import { chromium } from "playwright";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on("pageerror", e => errs.push(String(e.message)));
p.on("console", m => { if (m.type()==="error") errs.push(m.text()); });
await p.goto("http://localhost:3001", { waitUntil: "networkidle" });
await p.waitForTimeout(2500);
// Click the Dynamic widget trigger
const trigger = p.getByRole("button", { name: /log in or sign up|connect/i }).first();
await trigger.click().catch(e => console.log("click err", e.message));
await p.waitForTimeout(3500);
// Dynamic renders its modal (often in a shadow/portal). Look for typical content.
const modalText = await p.locator("body").innerText();
const hasModal = /(log in|sign up|continue with|email|wallet|metamask|connect a wallet)/i.test(modalText);
const dynModal = await p.locator('[class*="modal" i], [data-testid*="dynamic" i], iframe[src*="dynamic"]').count();
console.log("modal-ish content visible:", hasModal);
console.log("modal/dynamic elements:", dynModal);
await p.screenshot({ path: "/tmp/thermal-dynamic-modal.png" });
console.log("console errors:", errs.length ? errs.slice(0,6) : "none");
await b.close();
