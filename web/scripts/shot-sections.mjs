import { chromium } from "playwright";
const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"]});
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; p.on("pageerror",e=>errs.push(String(e.message)));
await p.goto("http://localhost:3001",{waitUntil:"networkidle"});
await p.screenshot({path:"/tmp/thermal-nav.png"}); // top (full-width nav)
await p.evaluate(()=>document.querySelector('#about')?.scrollIntoView());
await p.waitForTimeout(1200);
await p.screenshot({path:"/tmp/thermal-sections.png"});
console.log("overflow:", await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth));
console.log("errors:", errs.length?errs.slice(0,4):"none");
await b.close();
