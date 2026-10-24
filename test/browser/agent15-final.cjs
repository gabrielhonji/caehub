const {chromium,expect}=require('/security/node_modules/@playwright/test');

(async()=>{
  const browser=await chromium.launch({args:['--no-sandbox']});
  const errors=[];
  try{
    const owner=await browser.newPage({viewport:{width:1440,height:1000},locale:'pt-BR'});
    owner.on('pageerror',error=>errors.push(error.message));
    const base='http://agent15-cae-api:8080';
    const foundation=await (await owner.request.get(base+'/api/foundation')).json();
    const board=foundation.boards[0];
    const created=await owner.request.post(base+'/api/boards/'+board.id+'/cards',{data:{title:'Cartão visual Agente 15',description:'Descrição fictícia',tags:['visual','teste'],priority:'high',columnId:board.columns[0].id}});
    expect(created.ok(),await created.text()).toBeTruthy();
    const cardId=(await created.json()).id;

    await owner.goto(base+'/#/cartoes/'+cardId);
    await expect(owner.getByRole('heading',{level:1,name:'Cartão visual Agente 15'})).toBeVisible();
    await expect(owner.getByText('visual',{exact:true})).toBeVisible();
    await expect(owner.getByText('Alta',{exact:true})).toBeVisible();
    for(const width of [1440,390]){
      await owner.setViewportSize({width,height:844});
      for(const theme of ['light','dark']){
        await owner.evaluate(value=>document.documentElement.dataset.theme=value,theme);
        expect(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
        await owner.screenshot({path:`/evidence/card-${width}-${theme}.png`,fullPage:true});
      }
    }

    const member=await browser.newPage({viewport:{width:390,height:844},locale:'pt-BR'});
    member.on('pageerror',error=>errors.push(error.message));
    await member.goto('http://agent15-cae-api:8081/#/cartoes/'+cardId);
    await expect(member.getByRole('textbox',{name:'Novo comentário'})).toBeVisible();
    await member.getByRole('textbox',{name:'Novo comentário'}).fill('Comentário fictício de leitor');
    await member.getByRole('button',{name:'Comentar',exact:true}).click();
    await expect(member.getByText('Comentário fictício de leitor',{exact:true})).toBeVisible();
    await expect(member.getByRole('button',{name:/Excluir comentário/})).toBeVisible();
    await expect(member.getByText('Gerenciar cartão',{exact:true})).toHaveCount(0);

    await owner.setViewportSize({width:1440,height:1000});
    await owner.goto(base+'/#/agenda?tab=meetings');
    await owner.getByRole('button',{name:'Criar reunião',exact:true}).click();
    const meeting=owner.getByRole('dialog',{name:'Criar reunião',exact:true});
    const checks=meeting.locator('input[name=participantIds]');
    await meeting.getByRole('combobox',{name:'Espaço responsável',exact:true}).selectOption(board.workspaceId);
    await expect.poll(()=>checks.evaluateAll(nodes=>nodes.filter(node=>node.checked).length)).toBeGreaterThan(0);
    for(const width of [1440,390]){
      await owner.setViewportSize({width,height:844});
      for(const theme of ['light','dark']){
        await owner.evaluate(value=>document.documentElement.dataset.theme=value,theme);
        expect(await owner.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
        await meeting.screenshot({path:`/evidence/meeting-${width}-${theme}.png`});
      }
    }
    await owner.keyboard.press('Escape');

    await owner.goto(base+'/#/minhas-tarefas');
    const taskFilters=owner.locator('.task-filters');
    await expect(taskFilters.getByRole('button',{name:'Atualizar minhas tarefas',exact:true})).toBeVisible();
    await owner.goto(base+'/#/agenda?tab=operations');
    await expect(owner.getByRole('button',{name:'Atualizar votações e turnos',exact:true})).toBeVisible();

    const publicPage=await browser.newPage({viewport:{width:390,height:844},locale:'pt-BR'});
    publicPage.on('pageerror',error=>errors.push(error.message));
    await publicPage.route('**/api/public/buyer-status',route=>route.fulfill({json:{canBuy:false}}));
    await publicPage.goto('http://agent15-cae-api:8082/#/meus-pedidos');
    const google=publicPage.getByRole('link',{name:'Entrar ou criar conta com Google',exact:true});
    await expect(google).toBeVisible();
    expect(await google.getAttribute('href')).toContain('returnTo=');
    expect(decodeURIComponent(await google.getAttribute('href'))).toContain('/#/meus-pedidos');
    await publicPage.screenshot({path:'/evidence/orders-login-mobile-dark.png',fullPage:true});

    expect(errors).toEqual([]);
    console.log('PASS Agent 15: card permissions/tags/priority, viewer comments, agenda audience, contextual refresh and login return; desktop/mobile light/dark without horizontal overflow.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
