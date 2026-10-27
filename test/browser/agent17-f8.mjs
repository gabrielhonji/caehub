import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('/security/node_modules/@playwright/test');

const origin=process.env.CAEHUB_BROWSER_ORIGIN;
const evidence=process.env.CAEHUB_EVIDENCE_DIR;
if(!origin||!evidence||process.env.NODE_ENV!=='development')throw new Error('Disposable origin, evidence path and development mode are required');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light',locale:'pt-BR'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
try{
  await page.goto(`${origin}/#/agenda?tab=availability`);await page.getByRole('heading',{name:'Meus horários',exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Gerenciar disponibilidade'}).click();
  const availability=page.getByRole('dialog',{name:'Meus horários'});await availability.waitFor();
  if(!await availability.getByRole('button',{name:/Editar /}).count()){
    await availability.getByLabel('Início',{exact:true}).fill('09:00');
    await availability.getByLabel('Término',{exact:true}).fill('10:00');
    await availability.getByRole('button',{name:'Adicionar indisponibilidade'}).click();
    await availability.getByRole('button',{name:/Editar /}).first().waitFor();
  }
  assert.ok(await availability.getByRole('button',{name:/Editar /}).count());
  assert.ok(await availability.getByRole('button',{name:'Remover indisponibilidade'}).count());
  await availability.screenshot({path:`${evidence}/agenda-disponibilidade-desktop-light.png`});await noOverflow();
  await availability.getByRole('button',{name:'Remover indisponibilidade'}).first().click();
  const removal=page.getByRole('dialog',{name:'Remover indisponibilidade'});await removal.waitFor();
  await removal.getByRole('button',{name:'Cancelar'}).click();
  await availability.getByRole('button',{name:'Fechar diálogo'}).click();

  await page.goto(`${origin}/#/agenda?tab=meetings`);await page.getByRole('button',{name:'Consultar horários'}).click();
  const planning=page.getByRole('dialog',{name:'Consultar disponibilidade semanal'});await planning.waitFor();
  await planning.getByRole('button',{name:'Consultar semana'}).click();
  const hours=planning.getByLabel('Mostrar apenas horários entre 7 e 23 h');await hours.waitFor();assert.ok(await hours.isChecked());
  assert.equal(await planning.locator('.weekly-results').getByRole('button',{name:'Solicitar revisão aos participantes'}).count(),0);
  const schedule=planning.getByRole('button',{name:'Convocar neste intervalo'}).first();
  if(await schedule.count()){
    await schedule.click();const meeting=page.getByRole('dialog',{name:'Criar reunião'});await meeting.waitFor();
    await meeting.getByRole('button',{name:'← Voltar'}).click();await planning.waitFor();
  }
  await planning.getByRole('button',{name:'Fechar diálogo'}).click();

  await page.goto(`${origin}/#/agenda?tab=operations`);await page.getByRole('heading',{name:'Votações e turnos'}).waitFor();
  await page.screenshot({path:`${evidence}/agenda-votacoes-desktop-light.png`,fullPage:true});await noOverflow();

  await page.goto(`${origin}/#/comercial`);await page.getByRole('heading',{name:/Cada campanha/}).waitFor();
  await page.screenshot({path:`${evidence}/comercial-desktop-light.png`,fullPage:true});await noOverflow();

  await page.goto(`${origin}/#/espacos/1a4e0bd0-5f4a-4d10-8000-000000000201`);await page.waitForLoadState('networkidle');
  await page.screenshot({path:`${evidence}/kanban-desktop-light.png`,fullPage:true});await noOverflow();

  await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});
  await page.goto(`${origin}/#/agenda?tab=availability`);await page.waitForLoadState('networkidle');
  await page.screenshot({path:`${evidence}/agenda-mobile-dark.png`,fullPage:true});await noOverflow();
  assert.deepEqual(errors,[]);
  console.log('PASS F8 visual: Agenda controls, operations, commercial and Kanban; desktop light and Agenda mobile dark without overflow.');
}finally{await browser.close();}
