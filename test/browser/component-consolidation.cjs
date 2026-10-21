// Real consumer forms against the disposable stabilization fixture; no production writes.
const {chromium,expect}=require(process.env.CAEHUB_PLAYWRIGHT_MODULE||'/security/node_modules/@playwright/test');

(async()=>{
  const browser=await chromium.launch({args:['--no-sandbox']});
  try {
    const page=await browser.newPage({locale:'pt-BR',timezoneId:'America/Sao_Paulo'});
    page.setDefaultTimeout(10000);
    const base=process.env.CAE_TEST_URL||'http://agent14-cae-api:8080';
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const foundation=await (await page.request.get(base+'/api/foundation')).json();
    const board=foundation.boards[0],title='Cartão fictício componentes '+Date.now();
    await page.goto(base+'/#/espacos/'+board.workspaceId);
    await page.getByRole('button',{name:'Novo cartão',exact:true}).click();
    let dialog=page.getByRole('dialog',{name:'Criar cartão',exact:true});
    await dialog.getByLabel('Título',{exact:true}).fill(title);
    await dialog.locator('details.optional-fields>summary').click();
    await expect(dialog.getByRole('combobox',{name:'Prioridade',exact:true})).toHaveValue('normal');
    await expect(dialog.getByLabel('Prazo',{exact:true})).toHaveValue('');
    await dialog.getByRole('combobox',{name:'Prioridade',exact:true}).selectOption('high');
    await dialog.getByLabel('Prazo',{exact:true}).fill('2027-04-19');
    await dialog.getByRole('button',{name:'Criar cartão',exact:true}).click();
    await expect(dialog).not.toBeVisible();
    await page.locator('.card-detail-trigger').filter({has:page.getByRole('heading',{name:title,exact:true})}).click();
    dialog=page.getByRole('dialog').filter({has:page.locator('.card-collaboration')});
    await dialog.locator('.card-administration>summary').click();
    await dialog.getByRole('button',{name:'Editar cartão',exact:true}).click();
    await expect(dialog.getByRole('combobox',{name:'Prioridade',exact:true})).toHaveValue('high');
    await expect(dialog.getByLabel('Prazo',{exact:true})).toHaveValue('2027-04-19');
    await dialog.getByRole('combobox',{name:'Prioridade',exact:true}).selectOption('low');
    await dialog.getByLabel('Prazo',{exact:true}).fill('');
    await dialog.getByRole('button',{name:'Salvar alterações',exact:true}).click();
    await expect(dialog.locator('.card-editor')).toHaveCount(0);
    if(!await dialog.getByRole('button',{name:'Editar cartão',exact:true}).isVisible())await dialog.locator('.card-administration>summary').click();
    await dialog.getByRole('button',{name:'Editar cartão',exact:true}).click();
    await expect(dialog.getByRole('combobox',{name:'Prioridade',exact:true})).toHaveValue('low');
    await expect(dialog.getByLabel('Prazo',{exact:true})).toHaveValue('');
    for(const width of [1440,390])for(const theme of ['light','dark']) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await dialog.getByRole('combobox',{name:'Prioridade',exact:true}).focus();
      await page.keyboard.press('Tab');
      await expect(dialog.getByLabel('Prazo',{exact:true})).toBeFocused();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
      await page.screenshot({path:`/evidence/component-card-${width}-${theme}.png`});
    }
    await page.goto(base+'/#/agenda?tab=meetings&plan=find');
    dialog=page.getByRole('dialog').filter({has:page.locator('.agenda-workflow-nav')});
    const picker=dialog.locator('form:visible .participant-picker');
    const checkbox=picker.getByRole('checkbox').first();
    await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).toBeChecked();
    const selected=await checkbox.getAttribute('value');
    const submitted=await picker.evaluate(e=>new FormData(e.closest('form')).getAll('membershipIds'));
    expect(submitted).toContain(selected);
    await dialog.getByRole('button',{name:'Período específico',exact:true}).click();
    const period=dialog.locator('form:visible .participant-picker').getByRole('checkbox').first();
    await period.check();await expect(period).toBeChecked();
    expect(await period.evaluate(e=>new FormData(e.form).getAll('membershipIds'))).toContain(await period.getAttribute('value'));
    expect(errors).toEqual([]);
    console.log('PASS shared card fields: defaults/create/save/clear, keyboard, themes/mobile; native participant selection and FormData in week/period.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
