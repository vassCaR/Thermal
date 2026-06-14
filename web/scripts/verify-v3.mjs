import { chromium } from "playwright";
const BASE="http://localhost:3001";
let failed=false; const fail=m=>{console.error("FAIL:",m);failed=true;}; const ok=m=>console.log("ok:",m);
const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"]});
const p=await b.newPage({viewport:{width:1280,height:900}});
const errs=[]; p.on("pageerror",e=>errs.push(String(e.message))); p.on("console",m=>m.type()==="error"&&errs.push(m.text()));

// HOME
await p.goto(BASE,{waitUntil:"networkidle"});
const body=await p.locator("body").innerText();
/choose your amount/i.test(body)?ok("section 01: 'Choose your amount'"):fail("section 01 copy not updated");
/hold to support/i.test(body)?fail("'Hold to support' still present"):ok("'Hold to support' removed");
await p.getByRole("link",{name:/^dashboard$/i}).first().isVisible()?ok("Dashboard nav link"):fail("Dashboard nav link missing");
// creator selector
(await p.getByTestId("creator-ghost:alice").isVisible())?ok("creator selector present"):fail("creator selector missing");
await p.getByTestId("creator-ghost:carol").click();
ok("switched creator -> ghost:carol");
// support carol
const before=(await p.getByTestId("supported-total").textContent())?.trim();
await p.getByTestId("amount-5.00").click();
await p.getByTestId("support-creators").click();
await p.waitForTimeout(1500);
const after=(await p.getByTestId("supported-total").textContent())?.trim();
after!==before?ok(`supported carol (${before}->${after})`):fail("support did not update");

// DASHBOARD for carol
await p.goto(BASE+"/dashboard?id=ghost:carol",{waitUntil:"networkidle"});
await p.waitForTimeout(1500);
(await p.getByTestId("become-creator").isVisible())?ok("dashboard: become-creator"):fail("become-creator missing");
const total=(await p.getByTestId("creator-total").textContent())?.trim();
console.log("creator-total (carol):", total);
total && total!=="0.000000" ? ok("dashboard shows received total") : fail("creator total is 0 (expected >0 after support)");
await p.getByTestId("withdraw").click();
await p.getByText(/arc settlement:/i).waitFor({timeout:8000}).then(()=>ok("withdraw -> Arc settlement txRef")).catch(()=>fail("withdraw produced no txRef"));

// CREATOR PAGE
await p.goto(BASE+"/creator/ghost:bob",{waitUntil:"networkidle"});
(await p.getByTestId("demo-badge").isVisible())?ok("creator page: support widget"):fail("creator page widget missing");
(await p.getByTestId("creator-ghost:alice").count())===0?ok("creator page: picker hidden (fixed creator)"):fail("picker should be hidden on creator page");
await p.getByTestId("support-creators").click();
await p.waitForTimeout(1200);
const cTotal=(await p.getByTestId("supported-total").textContent())?.trim();
cTotal && cTotal!=="0.000000 USDC"?ok(`creator page support works (${cTotal})`):fail("creator page support failed");

await p.screenshot({path:"/tmp/thermal-v3-dashboard.png"});
console.log("console errors:",errs.length?errs.slice(0,6):"none");
if(errs.length)fail("console errors");
await b.close();
console.log(failed?"RESULT: FAILED":"RESULT: PASS");
process.exit(failed?1:0);
