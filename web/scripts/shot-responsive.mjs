import { chromium } from "playwright";
const b=await chromium.launch({args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"]});
const sizes=[[375,812,"mobile"],[768,1024,"tablet"],[1440,900,"desktop"]];
const errs=[];
for(const [w,h,name] of sizes){
  const p=await b.newPage({viewport:{width:w,height:h}});
  p.on("pageerror",e=>errs.push(`${name}: ${e.message}`));
  await p.goto("http://localhost:3001",{waitUntil:"networkidle"});
  await p.waitForTimeout(800);
  const ov=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  console.log(`${name} ${w}x${h} overflow-x: ${ov}px ${ov<=1?"OK":"BAD"}`);
  await p.screenshot({path:`/tmp/resp-${name}.png`});
  await p.close();
}
console.log("errors:", errs.length?errs:"none");
await b.close();
