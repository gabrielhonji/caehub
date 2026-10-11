import { randomUUID } from 'node:crypto';
import { buildApp } from './app.js';
import { DevelopmentIdentityGateway } from './auth.js';
import { configFromEnv, connect, migrate } from './database.js';
import { InstitutionalService } from './service.js';

export async function agendaFixture() {
  const db=await connect(configFromEnv(process.env));await migrate(db);await migrate(db);
  const suffix=randomUUID();
  const actors={owner:{subject:`agenda-owner-${suffix}`,displayName:'Admin fictício',owner:true,projectAccess:true},director:{subject:`agenda-director-${suffix}`,displayName:'Direção fictícia',owner:false,projectAccess:true},member:{subject:`agenda-member-${suffix}`,displayName:'Membro fictício',owner:false,projectAccess:true},other:{subject:`agenda-other-${suffix}`,displayName:'Outro fictício',owner:false,projectAccess:true}};
  const service=new InstitutionalService(db),apps=Object.fromEntries(Object.entries(actors).map(([name,actor])=>[name,buildApp(service,new DevelopmentIdentityGateway(actor))])) as Record<keyof typeof actors,ReturnType<typeof buildApp>>;
  const ids:Record<string,string>={};
  for(const name of ['director','member','other'] as const) {
    const response=await apps.owner.inject({method:'POST',url:'/api/members',payload:{honjiSubject:actors[name].subject,displayName:actors[name].displayName,role:name==='director'?'director':'member'}});
    if(response.statusCode!==201)throw new Error(`Fixture failed: ${response.statusCode}`);ids[name]=response.json().id;
  }
  ids.owner=(await apps.owner.inject({method:'GET',url:'/api/me'})).json().membership.id;
  return {db,service,actors,apps,ids,close:async()=>{await Promise.all(Object.values(apps).map(app=>app.close()));await db.close();}};
}
