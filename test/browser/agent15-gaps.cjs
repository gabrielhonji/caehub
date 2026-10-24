const {chromium,expect}=require('/security/node_modules/@playwright/test');

const catalog={
  campaigns:[{id:'campaign',name:'Lojinha 2026/2',description:'Campanha fictícia',semester:'2026/2',stage:'orders',status:'active',version:1}],
  products:[{id:'shirt',name:'Camisa do CAECOMP',description:'Produto fictício',sku:'CAM',category:'Camisetas',mode:'preorder',campaignId:'campaign',saleCents:6000,status:'active'}],
  variants:[
    ['traditional-s','Tradicional · P',{Modelo:'Tradicional',Tamanho:'P'}],
    ['traditional-m','Tradicional · M',{Modelo:'Tradicional',Tamanho:'M'}],
    ['baby-s','Baby look · P',{Modelo:'Baby look',Tamanho:'P'}],
    ['baby-m','Baby look · M',{Modelo:'Baby look',Tamanho:'M'}],
  ].map(([id,name,attributes])=>({id,productId:'shirt',name,attributes,status:'active',availableQuantity:20})),
  links:[{campaignId:'campaign',productId:'shirt'}],reservationMinutes:120,
};
const session={subject:'member',displayName:'Pessoa fictícia',csrfToken:'csrf',projectAccess:true,institutionalAccess:false,buyerAccess:true,membership:null,owner:false};

(async()=>{
  const browser=await chromium.launch({args:['--no-sandbox']});
  const errors=[];
  try{
    const shop=await browser.newPage({viewport:{width:390,height:844},locale:'pt-BR'});let catalogRequests=0;
    shop.on('pageerror',error=>errors.push(error.message));
    await shop.route('**/api/public/catalog',async route=>{catalogRequests++;await new Promise(resolve=>setTimeout(resolve,80));await route.fulfill({json:catalog});});
    await shop.route('**/api/public/buyer-status',route=>route.fulfill({json:{canBuy:false}}));
    await shop.goto('http://web:5173/');
    await shop.getByRole('button',{name:'Ver produto',exact:true}).click();
    const dialog=shop.getByRole('dialog',{name:'Camisa do CAECOMP'});
    await expect(dialog.getByRole('group',{name:'Modelo'})).toBeVisible();
    await expect(dialog.getByRole('group',{name:'Tamanho'})).toBeVisible();
    await dialog.getByRole('button',{name:'Baby look',exact:true}).click();
    await dialog.getByRole('button',{name:'M',exact:true}).click();
    await dialog.getByRole('button',{name:'Adicionar ao carrinho',exact:true}).click();
    await expect(shop.getByRole('button',{name:'Remover Camisa do CAECOMP da seleção'})).toBeVisible();
    const refresh=shop.getByRole('button',{name:'Atualizar catálogo',exact:true});
    const beforeRefresh=catalogRequests;
    await refresh.click();await refresh.click({force:true});
    await expect.poll(()=>catalogRequests).toBe(beforeRefresh+1);
    for(const theme of ['light','dark']){await shop.evaluate(value=>document.documentElement.dataset.theme=value,theme);expect(await shop.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();}

    const directory=await browser.newPage({viewport:{width:1440,height:900},locale:'pt-BR'});
    directory.on('pageerror',error=>errors.push(error.message));
    await directory.route('**/api/me',route=>route.fulfill({json:{...session,institutionalAccess:true,membership:{id:'member',role:'member',status:'active'}}}));
    await directory.route('**/api/foundation',route=>route.fulfill({json:{workspaces:[],tasks:[],boards:[],canManageStructure:false}}));
    await directory.route('**/api/organization/departments',route=>route.fulfill({json:[{id:'events',name:'Eventos'}]}));
    await directory.route('**/api/departments/events/participants',route=>route.fulfill({json:[{membershipId:'director',displayName:'Direção fictícia',kind:'director'}]}));
    await directory.goto('http://web:5173/#/departamentos');
    await expect(directory.getByRole('link',{name:/Gerenciar estrutura no Honji/})).toHaveCount(0);
    await directory.getByRole('link',{name:/Eventos/}).click();
    await expect(directory.getByText('Direção fictícia · Direção')).toBeVisible();
    expect(await directory.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();
    expect(errors).toEqual([]);
    console.log('PASS Agent 15 gaps: variant dimensions, cart removal, refresh locking, responsive themes and safe department directory.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
