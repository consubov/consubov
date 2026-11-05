import {test,expect,type Page} from "@playwright/test";
declare global {
  interface Window{
    __qaManual:{sentHeaders:Record<string,unknown>[];sentItems:Record<string,unknown>[][];rollbackIds:string[];failNext:boolean};
    __qaToasts:{kind:string;message:string}[];
  }
}
const url="/qa-manual/harness.html";
const sacos=(page:Page,n:number)=>page.getByRole("spinbutton",{name:"Quantidade de sacos de Pasto QA "+String(n).padStart(2,"0")});
const geral=(page:Page)=>page.getByRole("textbox",{name:"Motivo geral do lançamento manual"});
test("motivo geral, exceção e cocho cheio gravados no mesmo lote",async ({page})=>{
  const errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(url);
  await expect(page.getByRole("dialog",{name:"Lançamento Manual"})).toBeVisible();
  await geral(page).fill("QR danificado");
  await sacos(page,1).fill("2");
  await sacos(page,2).fill("3");
  await page.getByRole("textbox",{name:"Motivo específico de Pasto QA 02"}).fill("Celular sem bateria");
  await page.locator("#cc-qa-3").click();
  await page.getByRole("button",{name:"Enviar Solicitação"}).click();
  await expect(page.getByText("Histórico de solicitações enviadas")).toBeVisible();
  const result=await page.evaluate(()=>({h:window.__qaManual.sentHeaders,rows:window.__qaManual.sentItems,toasts:window.__qaToasts}));
  expect(result.h).toHaveLength(1);
  expect(result.h[0].total_sacos).toBe(5);
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].map(r=>[r.pasto_id,r.num_sacos,r.motivo,r.cocho_cheio])).toEqual([
    ["qa-1",2,"QR danificado",false],["qa-2",3,"Celular sem bateria",false],["qa-3",0,"QR danificado",true],
  ]);
  expect(result.toasts.some(t=>t.kind==="success")).toBe(true);
  expect(errors).toEqual([]);
});
test("motivo obrigatório: bloqueia antes de criar pedido",async ({page})=>{
  await page.goto(url);
  await sacos(page,1).fill("5");
  await page.getByRole("button",{name:"Enviar Solicitação"}).click();
  expect(await page.evaluate(()=>window.__qaManual.sentHeaders.length)).toBe(0);
  expect(await page.evaluate(()=>window.__qaToasts.some(t=>t.kind==="error"&&t.message.includes("motivo")))).toBe(true);
  await expect(sacos(page,1)).toHaveValue("5");
});
test("falha simulada de envio preserva rascunho, rollback e retry",async ({page})=>{
  await page.goto(url);
  await geral(page).fill("QR danificado");
  await sacos(page,1).fill("3");
  await page.evaluate(()=>{window.__qaManual.failNext=true;});
  await page.getByRole("button",{name:"Enviar Solicitação"}).click();
  await expect.poll(()=>page.evaluate(()=>window.__qaManual.rollbackIds.length)).toBe(1);
  await expect(sacos(page,1)).toHaveValue("3");
  await expect(geral(page)).toHaveValue("QR danificado");
  await page.getByRole("button",{name:"Enviar Solicitação"}).click();
  await expect.poll(()=>page.evaluate(()=>window.__qaManual.sentItems.length)).toBe(2);
  await expect(page.getByText("Histórico de solicitações enviadas")).toBeVisible();
});
test("33 pastos / 21 sacos / cochos: modal mobile sem overflow da página",async ({page},testInfo)=>{
  test.skip(testInfo.project.name!=="chromium-mobile","Stress mobile");
  await page.goto(url+"?pastos=33");
  await geral(page).fill("QR sem leitura");
  for(let i=1;i<=7;i++)await sacos(page,i).fill("3");
  for(let i=8;i<=33;i++)await page.locator("#cc-qa-"+i).click();
  await page.getByRole("button",{name:"Enviar Solicitação"}).click();
  await expect.poll(()=>page.evaluate(()=>window.__qaManual.sentItems[0]?.length)).toBe(33);
  const x=await page.evaluate(()=>window.__qaManual.sentItems[0]);
  expect(x.filter(i=>i.cocho_cheio&&i.num_sacos===0)).toHaveLength(26);
  expect(x.reduce((s,i)=>s+Number(i.num_sacos),0)).toBe(21);
  expect(x.every(i=>i.motivo==="QR sem leitura")).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)).toBe(false);
});


test("mobile pequeno: motivo geral fixo na tela ao rolar, sem alertas prematuros", async ({page}) => {
  await page.setViewportSize({width:280,height:480});
  await page.goto(url+"?pastos=33");
  const list=page.getByTestId("pastos-scroll");
  await list.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await expect(geral(page)).toBeInViewport({ratio:0.8});
  await page.locator("#cc-qa-32").click();
  await page.locator("#cc-qa-33").click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button",{name:"Enviar Solicitação"}).click();
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(geral(page)).toBeFocused();
  await geral(page).fill("QR danificado");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button",{name:"Enviar Solicitação"}).click();
  await expect.poll(()=>page.evaluate(()=>window.__qaManual.sentItems.length)).toBe(1);
  const rows=await page.evaluate(()=>window.__qaManual.sentItems[0]);
  expect(rows).toHaveLength(2);
  expect(rows.every(r=>r.cocho_cheio===true && r.num_sacos===0 && r.motivo==="QR danificado")).toBe(true);
});
