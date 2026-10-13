import assert from 'node:assert/strict';
const {chromium}=await import(process.env.CAEHUB_PLAYWRIGHT_MODULE??'@playwright/test');
const origin=process.env.CAEHUB_BROWSER_ORIGIN;
if(!origin||process.env.NODE_ENV!=='development')throw new Error('Explicit disposable origin and development environment required');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`${origin}/#/espacos/1a4e0bd0-5f4a-4d10-8000-000000000201`);
  const create=page.getByRole('button',{name:'Criar cartão',exact:true});await create.waitFor();
  const title=`Cartão fictício de auditoria ${Date.now()}`;
  await page.locator('.kanban-forms input[name=title]').fill(title);
  const saved=page.waitForResponse(r=>r.url().includes('/cards')&&r.request().method()==='POST');
  await create.click();assert.equal((await saved).status(),201);
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
  assert.equal(await page.locator('.kanban-forms input[name=title]').inputValue(),'');
  const column=`Coluna fictícia ${Date.now()}`;
  await page.locator('.kanban-forms input[name=name]').fill(column);
  const columnSaved=page.waitForResponse(r=>r.url().includes('/columns')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Adicionar coluna',exact:true}).click();
  assert.equal((await columnSaved).status(),201);
  await page.getByRole('heading',{name:column,exact:true}).waitFor();
  assert.equal(await page.locator('.kanban-forms input[name=name]').inputValue(),'');
  const card=page.locator('.card-detail-trigger').filter({has:page.getByRole('heading',{name:title,exact:true})});
  await card.click();await page.getByRole('dialog').waitFor();
  assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('dialog'))),true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>Boolean(document.activeElement?.closest('dialog'))),true);
  await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await card.evaluate(element=>element===document.activeElement),true);

  let attempts=0,unavailable=true;
  await page.route('**/api/my-tasks*',async route=>{
    attempts++;
    if(unavailable)await route.fulfill({status:503,contentType:'application/json',body:'{"error":"unavailable"}'});
    else await route.continue();
  });
  await page.goto(`${origin}/#/minhas-tarefas`);
  const retry=page.getByRole('button',{name:'Tentar novamente',exact:true});await retry.waitFor();
  const failedAttempts=attempts;unavailable=false;
  const recovered=page.waitForResponse(r=>r.url().includes('/api/my-tasks')&&r.status()===200);
  await retry.click();await recovered;
  await page.getByRole('link',{name:new RegExp(title)}).waitFor();
  assert.ok(attempts>failedAttempts);
  assert.deepEqual(errors,[]);
  console.log('PASS: persisted card/column refresh and clear forms; My tasks retries a transient failure and displays its task.');
}finally{await browser.close();}
