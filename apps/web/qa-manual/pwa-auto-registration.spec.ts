import {test,expect} from "@playwright/test";
test("PWA real: registro do app, assets completos, reload offline", async({page,context})=>{
  const failures:string[]=[];const bad:string[]=[];
  context.on("serviceworker", w=>w.on("console", msg=>{if(msg.text().includes("QA_"))console.log("SW_TRACE",msg.text());}));
  page.on("requestfailed",r=>failures.push(new URL(r.url()).pathname+" "+(r.failure()?.errorText??"")));
  page.on("response",r=>{if(r.status()>=400)bad.push(r.status()+" "+new URL(r.url()).pathname);});
  page.on("pageerror",e=>bad.push("JS "+e.message.slice(0,120)));
  await page.goto("/baixar",{waitUntil:"domcontentloaded"});
  await expect.poll(()=>page.locator("#root").innerText(),{timeout:25000}).not.toBe("");
  await expect.poll(()=>page.evaluate(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active)),{timeout:30000}).toBe(true);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),{timeout:30000}).toBe(true);
  await expect.poll(()=>page.evaluate(async()=>{
    const keys=await caches.keys();const assets=keys.find(k=>k.startsWith("consubov-v-"));
    return assets? (await(await caches.open(assets)).keys()).length:0;
  }),{timeout:30000}).toBeGreaterThan(330);
  await page.waitForTimeout(1500);
  console.log("BEFORE",JSON.stringify(await page.evaluate(async()=>({
    caches:await caches.keys(), active:(await navigator.serviceWorker.getRegistration())?.active?.scriptURL,
    waiting:(await navigator.serviceWorker.getRegistration())?.waiting?.scriptURL,
    installing:(await navigator.serviceWorker.getRegistration())?.installing?.scriptURL
  }))));
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForTimeout(1400);
  const diag=await page.evaluate(async()=>({title:document.title,html:document.documentElement.outerHTML.slice(0,95),
    text:document.querySelector("#root")?.textContent?.length??-1,caches:await caches.keys()}));
  const path=await page.evaluate(()=>document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute("src")??"");
  console.log("ASSET_DEBUG",JSON.stringify(await page.evaluate(async(path)=>{
    const keys=await caches.keys(),name=keys.find(n=>n.startsWith("consubov-v-"))??"missing";
    const c=await caches.open(name);
    const key=(await c.keys()).find(r=>r.url.endsWith(path));
    const r1=await c.match(path);
    const r2=await c.match(new Request(path,{mode:"cors",credentials:"same-origin"}));
    const r3=await c.match(new Request(path,{mode:"same-origin",credentials:"same-origin"}));
    const withOrigin=await c.match(new Request(path,{headers:{"Origin":location.origin},mode:"cors"}));
    const withOriginIgnored=await c.match(new Request(path,{headers:{"Origin":location.origin},mode:"cors"}),{ignoreVary:true});
    let liveStatus=0;try{liveStatus=(await fetch(path)).status}catch{liveStatus=-1}
    return {name,key:!!key,keyMode:key?.mode,keyCredentials:key?.credentials,keyHeaders:[...(key?.headers.entries()??[])].filter(k=>k[0].toLowerCase()==="origin"),
      responseVary:r1?.headers.get("vary"),responseStatus:r1?.status,urlMatch:!!r1,corsMatch:!!r2,sameMatch:!!r3,
      originMatch:!!withOrigin,originIgnoreVaryMatch:!!withOriginIgnored,liveStatus};
  },path)));
  console.log("AFTER",JSON.stringify(diag),"FAILURES",failures.slice(-12),"BAD",bad.slice(-12));
  expect(diag.text).toBeGreaterThan(0);
  expect(diag.caches.length).toBeGreaterThan(0);
  // External fonts and online-only version checks may fail offline; the
  // version-pinned SPA shell, hashed JS/CSS and public manifest must not 504.
  expect(bad.filter(x=>/^504 \/(?:assets\/|manifest(?:-[a-z0-9]+)?\.json)/.test(x))).toEqual([]);
});
