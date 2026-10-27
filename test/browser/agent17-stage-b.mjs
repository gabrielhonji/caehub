import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {chromium}=createRequire(import.meta.url)('/security/node_modules/@playwright/test');
const origin=process.env.CAEHUB_BROWSER_ORIGIN;
const evidence=process.env.CAEHUB_EVIDENCE_DIR;
if(!origin||!evidence||process.env.NODE_ENV!=='development')throw new Error('Disposable development origin and evidence directory are required');

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light',locale:'pt-BR'});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));

try{
  await page.goto(`${origin}/`);
  await page.getByRole('link',{name:'Relatar problema',exact:true}).waitFor();
  assert.equal(await page.locator('.footer-release>.footer-report+.footer-version').count(),1);
  const desktop=await page.locator('.footer-release').evaluate(node=>{
    const report=node.querySelector('.footer-report').getBoundingClientRect();
    const version=node.querySelector('.footer-version').getBoundingClientRect();
    return {reportRight:report.right,versionLeft:version.left};
  });
  assert.ok(desktop.reportRight<=desktop.versionLeft);
  await page.locator('.site-footer').screenshot({path:`${evidence}/footer-public-desktop-light.png`});
  await noOverflow();

  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({colorScheme:'dark'});
  await page.locator('.site-footer').screenshot({path:`${evidence}/footer-public-mobile-dark.png`});
  await noOverflow();

  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({colorScheme:'light'});
  await page.goto(`${origin}/#/agenda?tab=operations`);
  await page.getByRole('heading',{name:'Votações e turnos',exact:true}).waitFor();

  await page.getByRole('button',{name:/^Votações livres/}).click();
  await page.getByRole('button',{name:'Criar votação livre',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Criar votação livre',exact:true});
  await dialog.waitFor();
  assert.equal(await dialog.locator('.opinion-option-row').count(),2);
  await dialog.getByRole('button',{name:'Adicionar opção',exact:true}).click();
  assert.equal(await dialog.locator('.opinion-option-row').count(),3);
  const removeOption=dialog.getByRole('button',{name:'Remover opção 3',exact:true});
  const optionBox=await removeOption.boundingBox();
  assert.ok(optionBox&&Math.abs(optionBox.width-optionBox.height)<=1);
  await removeOption.click();
  assert.equal(await dialog.locator('.opinion-option-row').count(),2);
  await dialog.screenshot({path:`${evidence}/votacao-livre-preenchivel-desktop-light.png`});
  await page.keyboard.press('Escape');
  const discard=page.locator('dialog.dialog-confirming-discard');
  if(await discard.isVisible())await discard.getByRole('button',{name:'Descartar alterações'}).click();

  await page.getByRole('button',{name:/^Horários/}).click();
  await page.getByRole('button',{name:'Criar votação de horários',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Criar votação de horários',exact:true});
  await dialog.waitFor();
  const dates=dialog.locator('input[type=date]');
  assert.ok(await dates.first().getAttribute('min'));
  await dialog.getByRole('button',{name:'Adicionar outro dia',exact:true}).click();
  const same=await dates.first().inputValue();
  await dates.nth(1).fill(same);
  await dialog.getByText('Cada dia pode aparecer apenas uma vez.',{exact:true}).waitFor();
  assert.equal(await dialog.locator('.poll-time-remove svg').count(),3);
  await dialog.screenshot({path:`${evidence}/votacao-horarios-validacao-desktop-light.png`});
  await page.keyboard.press('Escape');
  if(await discard.isVisible())await discard.getByRole('button',{name:'Descartar alterações'}).click();

  await page.getByRole('button',{name:/^Turnos/}).click();
  await page.getByRole('button',{name:'Criar escala',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Criar escala',exact:true});
  await dialog.getByRole('button',{name:'Escala semanal',exact:true}).click();
  const labels=Object.fromEntries(await Promise.all(['Dia de início','Último dia','Primeiro turno','Término'].map(async name=>[name,await dialog.locator('label').filter({hasText:name}).first().boundingBox()])));
  assert.ok(labels['Dia de início']&&labels['Último dia']&&labels['Primeiro turno']&&labels['Término']);
  assert.ok(Math.abs(labels['Dia de início'].y-labels['Último dia'].y)<=2);
  assert.ok(Math.abs(labels['Primeiro turno'].y-labels['Término'].y)<=2);
  assert.ok(labels['Primeiro turno'].y>labels['Dia de início'].y);
  assert.ok(await dialog.locator('.shift-day-remove svg').count()>0);
  await dialog.screenshot({path:`${evidence}/escala-semanal-preenchida-desktop-light.png`});
  await noOverflow();
  await page.keyboard.press('Escape');
  if(await discard.isVisible())await discard.getByRole('button',{name:'Descartar alterações'}).click();

  assert.deepEqual(errors,[]);
  console.log('PASS footer release order and V01-V04 representative filled states, validation and responsive geometry.');
}finally{
  await browser.close();
}
