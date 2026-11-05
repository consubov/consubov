import {test,expect} from "@playwright/test";
test("build PWA v2.0.56: manifesto, SW ativado e shell offline em Chromium",async ({page,context})=>{
  await context.route("**/*",async route=>{
    const u=route.request().url();
    if(u.startsWith("http://127.0.0.1:18184/")||u.startsWith("data:"))return route.continue();
    return route.abort();
  });
  const errors:string[]=[];
  const failures:string[]=[];
  const badStatuses:string[]=[];
  page.on("requestfailed",req=>{try{failures.push(new URL(req.url()).pathname+" "+(req.failure()?.errorText??""));}catch{ /* Synthetic harness ignores invalid URLs. */ }});
  page.on("response",res=>{if(res.status()>=400){try{badStatuses.push(String(res.status())+" "+new URL(res.url()).pathname);}catch{ /* Synthetic harness ignores invalid URLs. */ }}});
  page.on("pageerror",e=>errors.push(e.name+": "+e.message.slice(0,180)));
  await page.goto("/baixar",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2500);
  console.log("ONLINE_ROOT_LEN", (await page.locator("#root").innerText()).length, "PAGE_ERRORS", errors);
  const version=await page.request.get("/version.json");
  expect(version.ok()).toBe(true);
  expect((await version.json()).appVersion).toBe("2.0.56");
  const manifest=await page.request.get("/manifest.json");
  expect(manifest.ok()).toBe(true);
  const m=await manifest.json();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/");
  await page.evaluate(async()=>{
    const reg=await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
    await navigator.serviceWorker.ready;
    if(!reg.active)throw new Error("SW não ativado");
  });
  await page.reload({waitUntil:"domcontentloaded"});
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller)),{timeout:30000}).toBe(true);
  await expect.poll(async()=>page.locator("#root").innerText(),{timeout:25000}).not.toBe("");
  await page.waitForLoadState("networkidle",{timeout:15000}).catch(()=>undefined);
  await page.waitForTimeout(850);
  console.log("PREFLIGHT_CACHE",JSON.stringify(await page.evaluate(async()=>{
    const names=await caches.keys();
    const list=[];
    for(const name of names){
      const c=await caches.open(name);
      const k=await c.keys();
      list.push({name,count:k.length,index:k.some(x=>x.url.endsWith("/index.html")),first:k.slice(0,2).map(x=>new URL(x.url).pathname)});
    }
    return list;
  })));
  await context.unrouteAll({behavior:"wait"}); // Rede externa já bloqueada na inicialização e agora será totalmente offline.
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded"});
  console.log("OFFLINE_DOCUMENT",JSON.stringify(await page.evaluate(async()=>({
    title:document.title,
    url:location.pathname,
    html:document.documentElement.outerHTML.slice(0,230),
    controller:!!navigator.serviceWorker?.controller,
    caches:await caches.keys(),
  }))),"NETWORK_FAILURES",failures.slice(-8),"BAD_RESPONSES",badStatuses.slice(-8));
  console.log("ASSET_CACHE_DIAG",JSON.stringify(await page.evaluate(async()=>{
    const script=document.querySelector<HTMLScriptElement>('script[type="module"][src]');
    const url=script?.src??"";
    const names=await caches.keys();
    const cache=await caches.open(names.find(n=>n.startsWith("consubov-v-"))??"missing");
    const exact=await cache.match(url);
    const ignore=await cache.match(url,{ignoreVary:true});
    let fetched=-1;
    try{const r=await fetch(url);fetched=r.status;}catch{fetched=-2;}
    return {entry:url?new URL(url).pathname:null,exact:!!exact,ignoreVary:!!ignore,vary:ignore?.headers.get("vary")??null,fetched};
  })));
  await expect(page.locator("#root")).toBeAttached();
  expect(await page.evaluate(()=>document.documentElement.outerHTML.includes("Consubov"))).toBe(true);
  await page.waitForTimeout(1200);
  console.log("OFFLINE_ROOT_LEN",(await page.locator("#root").innerText()).length,"PAGE_ERRORS",errors,"FAILED",failures.slice(-15),"BAD",badStatuses.slice(-15));
  await expect.poll(async()=>page.locator("#root").innerText(),{timeout:8000}).not.toBe("");
  const sw=await page.evaluate(async()=>({
    controlled:!!navigator.serviceWorker.controller,
    caches:await caches.keys(),
    app:document.querySelector("#root")?.textContent?.length??0,
  }));
  expect(sw.controlled).toBe(true);
  expect(sw.caches.length).toBeGreaterThan(0);
  expect(sw.app).toBeGreaterThan(0);
});
