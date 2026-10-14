// UI regression harness: local builds, fictitious APIs, no production writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/security/node_modules/@playwright/test');
const uuid=n=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const session={subject:uuid(1),displayName:'Pessoa fictícia',csrfToken:'fixture',institutionalAccess:true,owner:false,membership:{id:uuid(1),role:'director',status:'active'}};
const space={id:uuid(2),name:'Espaço fictício',department:'Departamento fictício',participantCount:1,boardCount:1};
const board={id:uuid(3),workspaceId:space.id,name:'Quadro fictício',canManage:true,canWrite:true,columns:[{id:uuid(4),name:'Planejado',cards:[{id:uuid(6),title:'Tarefa fictícia',description:'Exemplo',helperCount:0,isHelper:false,canMove:true,version:1,visibility:'members'}]},{id:uuid(5),name:'Concluído',cards:[]}]};
const mime=file=>file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':'text/html';
async function assets(route,root){const url=new URL(route.request().url());let file=path.join(root,url.pathname==='/'?'index.html':url.pathname);if(!fs.existsSync(file)&&url.pathname.startsWith('/assets/'))file=path.join('/xii-assets',path.basename(url.pathname));assert(fs.existsSync(file),'Missing fixture asset '+file);await route.fulfill({body:fs.readFileSync(file),contentType:mime(file)});}
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 try{const page=await browser.newPage();let refreshDelay=false,moves=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url()),method=route.request().method();
 if(!u.pathname.startsWith('/api/'))return assets(route,'/cae');
 if(method!=='GET'){if(u.pathname.endsWith('/move')){moves++;const input=route.request().postDataJSON();const card=board.columns.flatMap(c=>c.cards)[0];board.columns.forEach(c=>c.cards=[]);board.columns.find(c=>c.id===input.columnId).cards=[{...card,version:card.version+1}];}return route.fulfill({json:{id:uuid(6)}});}
 if(u.pathname==='/api/me')return route.fulfill({json:session});
 if(u.pathname==='/api/foundation'){if(refreshDelay)await new Promise(r=>setTimeout(r,1500));return route.fulfill({json:{workspaces:[space],tasks:[],boards:[board]}});}
 if(u.pathname.startsWith('/api/workspaces/'))return route.fulfill({json:{...space,canManage:true,readOnly:false,participants:[]}});
 if(u.pathname.startsWith('/api/cards/'))return route.fulfill({json:{id:uuid(6),title:'Tarefa fictícia',description:'Exemplo',priority:'normal',tags:[],helpers:[],eligibleParticipants:[],checklist:[],comments:[],activities:Array.from({length:30},(_,i)=>({id:uuid(100+i),actor:'Pessoa fictícia',action:'Atualização fictícia'})),permissions:{edit:true,manage:true},currentMembershipId:uuid(1)}});
 return route.fulfill({json:[]});});
 await page.goto(`https://caehub.test/#/espacos/${space.id}`);
 await page.getByRole('button',{name:'Editar coluna Concluído'}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.locator('input[name=name]').inputValue(),'Concluído');assert.equal(await dialog.evaluate(e=>e.parentElement===document.body),true);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert.equal(await page.locator('.board-guidance,.card-move-field').count(),0);
 assert.equal(await page.locator('.kanban-forms .kanban-navigation').count(),1);
 await page.locator('.card-detail-trigger').click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 refreshDelay=true;const source=await page.locator('.card-upper').boundingBox(),target=await page.locator('.board-column').nth(1).boundingBox();await page.mouse.move(source.x+50,source.y+15);await page.mouse.down();await page.mouse.move(target.x+80,target.y+80,{steps:10});await page.mouse.up();await page.getByRole('status').filter({hasText:'Cartão movido.'}).waitFor();assert.equal(moves,1);assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.getByRole('button',{name:'Criar cartão',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'Editar Tarefa fictícia'}).click();await page.getByLabel('Mover Tarefa fictícia').waitFor();assert.equal(await page.locator('.activity-list li').count(),20);const field=page.getByLabel('Mover Tarefa fictícia');assert.equal(await field.evaluate(e=>getComputedStyle(e).minHeight),'44px');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Quero ajudar em Tarefa fictícia'}).click();const helper=page.getByRole('button',{name:'Deixar de ser auxiliar em Tarefa fictícia'});await helper.waitFor();assert.equal(await helper.textContent(),'🤝');await page.mouse.move(1,1);assert.equal(await helper.evaluate(e=>getComputedStyle(e).borderTopColor),'rgba(0, 0, 0, 0)');const toast=page.locator('.action-toast');assert.equal(await toast.evaluate(e=>e.matches(':popover-open')),true);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`/screenshots/ux14-${width}.png`,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS: unclipped column dialog, compact controls, upper-card mouse drag, edit-only movement, helper toggle and immediate confirmation before refresh; desktop/mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
