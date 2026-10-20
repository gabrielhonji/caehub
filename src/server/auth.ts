import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, errors, type JWTVerifyGetKey } from 'jose';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Actor } from './domain.js';
import type { Database } from './database.js';
import { synchronizeHierarchy } from './hierarchy.js';
import {debugModes,debugProfile,normalizeDebugMode} from './debug-profiles.js';
import { postIdentityForm } from './identity-http.js';

export class AuthenticationFailure extends Error {
  constructor(readonly status: 401 | 403 | 503, readonly code: string, message: string) { super(message); }
}
const unavailable=()=>new AuthenticationFailure(503,'identity_unavailable','A autenticação está temporariamente indisponível. Tente novamente.');
const denied=()=>new AuthenticationFailure(403,'access_denied','Sua conta não tem acesso ao CAEHUB.');
const csrfFailure=()=>new AuthenticationFailure(403,'csrf_invalid','Atualize a página antes de tentar novamente.');

export interface IdentityGateway { current(request?: FastifyRequest): Promise<Actor | undefined>; register?(app: FastifyInstance): void; }
export class UnavailableHonjiGateway implements IdentityGateway { async current(): Promise<Actor | undefined> { return undefined; } }
export class DevelopmentIdentityGateway implements IdentityGateway { constructor(private readonly actor: Actor | undefined) {} async current(): Promise<Actor | undefined> { return this.actor; } }
type Config={publicOrigin:string;issuer:string;identityOrigin:string;clientId:string;clientSecret:string;serviceClientId:string;serviceClientSecret:string;authorizationOrigin:string;ownerId:string};
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const cookie=(request:FastifyRequest,name:string)=>request.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith(`${name}=`))?.slice(name.length+1);
const form=(values:Record<string,string>)=>new URLSearchParams(values);
export function loginFailurePage(reply:FastifyReply,status:number,message:string){
  return reply.code(status).type('text/html').send(accessPage.replace('Entre para continuar.','Entre novamente.').replace('Use uma conta com acesso ao projeto CAECOMP. Seus espaços e ações serão mostrados conforme o seu vínculo.',message));
}
export function safeReturnTo(value:unknown):string {
  if(typeof value!=='string'||value.length>2048||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(value))return '/';
  const parsed=new URL(value,'https://caehub.invalid');
  if(parsed.origin!=='https://caehub.invalid'||/^\/(?:auth|acesso)(?:\/|$)/.test(parsed.pathname))return '/';
  return parsed.pathname+parsed.search+parsed.hash;
}
const accessBrandCss='.honji-symbol,.caecomp-symbol{display:block;flex:none;background:var(--accent);mask-position:center;mask-repeat:no-repeat;mask-size:contain;-webkit-mask-position:center;-webkit-mask-repeat:no-repeat;-webkit-mask-size:contain}.honji-symbol{width:30px;height:30px;mask-image:url("/assets/honji-symbol.svg");-webkit-mask-image:url("/assets/honji-symbol.svg")}.caecomp-symbol{width:34px;height:34px;mask-image:url("/assets/caecomp-kraken-mark-v3.png");-webkit-mask-image:url("/assets/caecomp-kraken-mark-v3.png")}.card-symbol .caecomp-symbol{width:48px;height:48px}#theme svg{display:block}';
const accessCss2=':root{color-scheme:light;--paper:#f8f4ed;--surface:#fffbf6;--text:#183b3d;--muted:#5c7372;--line:#c5d5cf;--accent:#145e63;--soft:#e8f0ec;--on-accent:#fffbf6;font-family:Arial,Helvetica,sans-serif}*{box-sizing:border-box}body{min-height:100vh;margin:0;padding:0 24px;background:var(--paper);color:var(--text);background-image:linear-gradient(color-mix(in srgb,var(--accent) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--accent) 7%,transparent) 1px,transparent 1px);background-size:72px 72px}header,main,footer{width:min(1280px,100%);margin:auto}header{min-height:88px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brands,.honji,.caecomp{display:flex;align-items:center}.brands{gap:14px}.brands>i{width:1px;height:34px;background:var(--line)}.honji,.caecomp{color:var(--text);text-decoration:none}.honji{gap:10px;font:700 26px/1 Georgia,serif}.honji img{width:30px;height:30px}.caecomp{gap:8px}.caecomp img{width:34px;height:34px;object-fit:contain}.caecomp span{display:grid;font-size:10px;line-height:1.25}.caecomp b{color:var(--muted);font-size:8px;font-weight:400}#theme{display:grid;place-items:center;width:44px;height:44px;padding:0;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);cursor:pointer}#theme svg{width:20px;height:20px;fill:currentColor}main{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(340px,.65fr);align-items:center;gap:clamp(48px,8vw,120px);min-height:calc(100svh - 158px);padding:80px 0}.eyebrow{color:var(--accent);font-size:9px;font-weight:700;letter-spacing:1.35px}.intro h1{margin:26px 0 28px;font:400 clamp(52px,6vw,82px)/1.02 Arial,sans-serif;letter-spacing:-4px}.intro h1 em{font-family:Georgia,serif;font-weight:400}.intro p,.access-card p{color:var(--muted);font-size:14px;line-height:1.7}.intro p{max-width:570px}.access-card{padding:32px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:0 18px 60px color-mix(in srgb,var(--text) 8%,transparent)}.card-symbol{display:grid;place-items:center;width:64px;height:64px;margin-bottom:32px;border-radius:12px;background:var(--soft)}.card-symbol img{width:48px;height:48px;object-fit:contain}.access-card h2{margin:10px 0 13px;font:400 30px/1.15 Arial,sans-serif;letter-spacing:-1.4px}.actions{display:grid;gap:9px;margin-top:26px}.actions a{display:flex;align-items:center;justify-content:space-between;min-height:46px;padding:11px 15px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);font:400 13px Arial,sans-serif;text-decoration:none}.actions .primary{border-color:var(--accent);background:var(--accent);color:var(--on-accent)}.actions a:hover,#theme:hover{border-color:var(--accent);background:var(--soft)}.actions .primary:hover{background:color-mix(in srgb,var(--accent) 88%,var(--text));color:var(--on-accent)}footer{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:20px;border-top:1px solid var(--line);color:var(--muted);font-size:9px;letter-spacing:.7px}footer a{color:var(--text)}:root[data-theme=dark]{color-scheme:dark;--paper:#151718;--surface:#1d2021;--text:#f0ede5;--muted:#b5bcba;--line:#3b4344;--accent:#65bea7;--soft:#263332;--on-accent:#151718}a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(max-width:760px){body{padding:0 16px;background-size:56px 56px}header{min-height:72px}.caecomp span{display:none}main{grid-template-columns:1fr;gap:38px;padding:58px 0}.intro h1{font-size:48px;letter-spacing:-2.5px}.access-card{padding:24px}footer{align-items:flex-start;flex-direction:column;justify-content:center}}';

export class HonjiGateway implements IdentityGateway {
  private readonly cookieName='__Host-caehub.sid'; private readonly jwks;
  private serviceToken?:{value:string;expiresAt:number};
  private serviceTokenRequest?:Promise<string|undefined>;
  private readonly provisionedOwners=new Set<string>();
  constructor(private readonly db:Database,private readonly config:Config){this.jwks=createRemoteJWKSet(new URL(`${config.issuer}/protocol/openid-connect/certs`));}
  private postIdentity(path:string,body:URLSearchParams){return postIdentityForm(new URL(`${this.config.identityOrigin}${path}`),new URL(this.config.issuer).host,body);}
  private async session(request:FastifyRequest){const sid=cookie(request,this.cookieName);if(!sid)return;return this.db.one<any>('SELECT subject,identity_session_id AS identitySessionId,display_name AS displayName,csrf_token AS csrfToken,debug_mode AS debugMode,created_at AS createdAt,last_activity_at AS lastActivity,expires_at AS expiresAt FROM caehub_sessions WHERE session_hash=? AND subject IS NOT NULL',[digest(sid)]);}
  private serviceAccessToken(){
    if(this.serviceToken&&this.serviceToken.expiresAt>Date.now()+5000)return Promise.resolve(this.serviceToken.value);
    if(this.serviceTokenRequest)return this.serviceTokenRequest;
    this.serviceTokenRequest=this.postIdentity('/protocol/openid-connect/token',form({grant_type:'client_credentials',client_id:this.config.serviceClientId,client_secret:this.config.serviceClientSecret})).then(async response=>{
      if(!response.ok)return;
      const body=await response.json() as {access_token?:string;expires_in?:number};
      if(!body.access_token)return;
      this.serviceToken={value:body.access_token,expiresAt:Date.now()+Math.max(1,Number(body.expires_in??30)-5)*1000};
      return body.access_token;
    }).finally(()=>{this.serviceTokenRequest=undefined;});
    return this.serviceTokenRequest;
  }
  async current(request?:FastifyRequest):Promise<Actor|undefined>{
    if(!request)return;
    const sid=cookie(request,this.cookieName),session=await this.session(request);if(!sid||!session)return;
    const now=Date.now();if(now-new Date(session.lastActivity).getTime()>=3600000||now>=new Date(session.expiresAt).getTime()){await this.db.run('DELETE FROM caehub_sessions WHERE session_hash=?',[digest(sid)]);return;}
    if(!session.identitySessionId){await this.db.run('DELETE FROM caehub_sessions WHERE session_hash=?',[digest(sid)]);return;}
    let authorization:{allowed:boolean;projectAccess:boolean;studentEmailVerified?:boolean;hierarchy?:unknown;institutionalAdmin?:boolean};
    try {
      const token=await this.serviceAccessToken();if(!token)throw unavailable();
      const decision=await fetch(`${this.config.authorizationOrigin}/internal/authorization/decisions`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({integrationId:'caehub',userId:session.subject,identitySessionId:session.identitySessionId,resource:{projectId:'CAECOMP'},action:'account.access'}),signal:AbortSignal.timeout(5000)});
      if(decision.status===401){const failure=await decision.json().catch(()=>({}));if(failure.error==='identity_session_expired'){await this.db.run('DELETE FROM caehub_sessions WHERE session_hash=?',[digest(sid)]);return;}throw unavailable();}
      if(decision.status===403)throw denied();
      if(!decision.ok)throw unavailable();
      authorization=await decision.json() as typeof authorization;
      if(typeof authorization?.allowed!=='boolean'||typeof authorization?.projectAccess!=='boolean')throw unavailable();
      if(!authorization.allowed)throw denied();
    } catch(error) { if(error instanceof AuthenticationFailure)throw error;throw unavailable(); }
    if(authorization.hierarchy)await synchronizeHierarchy(this.db,authorization.hierarchy);
    if(request.method!=='GET'&&request.method!=='HEAD'&&(request.headers.origin!==this.config.publicOrigin||request.headers['x-csrf-token']!==session.csrfToken))throw csrfFailure();
    const owner=session.subject===this.config.ownerId;
    if(owner&&!this.provisionedOwners.has(session.subject)){await this.db.run('INSERT IGNORE INTO people(id,honji_subject,display_name) VALUES(UUID(),?,?)',[session.subject,session.displayName]);await this.db.run("INSERT IGNORE INTO memberships(id,organization_id,person_id,role,status) SELECT UUID(),'1a4e0bd0-5f4a-4d10-8000-000000000001',id,'president','active' FROM people WHERE honji_subject=?",[session.subject]);this.provisionedOwners.add(session.subject);}
    if(now-new Date(session.lastActivity).getTime()>=60000)await this.db.run('UPDATE caehub_sessions SET last_activity_at=NOW(3) WHERE session_hash=?',[digest(sid)]);(request as any).caehubCsrf=session.csrfToken;
    const mode=owner?normalizeDebugMode(session.debugMode):'real';const template=owner&&mode!=='real'?debugProfile(mode):undefined;
    return {subject:template?.subject??session.subject,displayName:template?.name??session.displayName,projectAccess:template?.access??authorization.projectAccess,accountAccess:authorization.allowed,buyerAccess:authorization.studentEmailVerified===true,owner:owner&&mode==='real',institutionalAdmin:template?.admin??authorization.institutionalAdmin===true,centralHierarchy:Boolean(authorization.hierarchy),realSubject:session.subject,debugView:{available:owner,mode:owner?mode:'real'}};
  }
  register(app:FastifyInstance){
    const studentEmail=async(request:FastifyRequest,action:'request'|'confirm')=>{
      const actor=await this.current(request);
      if(!actor||!actor.accountAccess)throw new AuthenticationFailure(401,'session_required','Entre com Honji para continuar.');
      if(actor.debugView?.mode!=='real')throw denied();
      const body=request.body as Record<string,unknown>|undefined;
      const field=action==='request'?'studentEmail':'verificationToken';
      if(!body||Object.keys(body).some(key=>key!==field)||typeof body[field]!=='string')throw new AuthenticationFailure(403,'invalid_request','Confira os dados informados.');
      const session=await this.session(request);
      try{
        const token=await this.serviceAccessToken();if(!token)throw unavailable();
        const response=await fetch(`${this.config.authorizationOrigin}/internal/authorization/decisions`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({integrationId:'caehub',userId:actor.realSubject,identitySessionId:session.identitySessionId,resource:{projectId:'CAECOMP'},action:`account.student-email.${action}`,[field]:body[field]}),signal:AbortSignal.timeout(30000)});
        const result=await response.json() as {error?:string;sent?:boolean;verified?:boolean;message?:string};
        if(response.status>=500)throw unavailable();
        if(!response.ok)throw new AuthenticationFailure(403,'student_email_invalid',result.error??'Confira seu e-mail acadêmico e tente novamente.');
        return action==='request'?{sent:result.sent===true,message:result.message}:{verified:result.verified===true};
      }catch(error){if(error instanceof AuthenticationFailure)throw error;throw unavailable();}
    };
    app.post('/api/buyer/student-email',request=>studentEmail(request,'request'));
    app.post('/api/buyer/student-email/confirm',request=>studentEmail(request,'confirm'));
    app.get('/acesso',async(request,reply)=>{
      const query=request.query as Record<string,unknown>;
      let status=query.status;
      try {const actor=await this.current(request);if(actor?.accountAccess||actor?.projectAccess)return reply.redirect(safeReturnTo(query.returnTo));}
      catch(error){if(!(error instanceof AuthenticationFailure))throw error;status=error.status===503?'unavailable':'denied';}
      const messages:Record<string,[string,string]>={expired:['Sua sessão expirou.','Entre novamente com Honji para continuar de onde parou.'],denied:['Acesso não autorizado.','Sua conta não tem acesso ao CAEHUB. Solicite acesso à equipe responsável.'],unavailable:['Tente novamente em instantes.','A autenticação está temporariamente indisponível. Você pode tentar novamente.'],cancelled:['Entrada cancelada.','Você pode entrar novamente quando quiser.']};
      const message=messages[String(status)];
      const html=accessPage.replace('Entre para continuar.',message?.[0]??'Entre para continuar.').replace('Use uma conta com acesso ao projeto CAECOMP. Seus espaços e ações serão mostrados conforme o seu vínculo.',message?.[1]??'Use sua conta Honji ou entre com Google. Compradores externos precisam confirmar um e-mail @alunos.utfpr.edu.br. A área institucional depende de acesso concedido por um administrador.');
      const returnTo=safeReturnTo(query.returnTo);
      const session=await this.session(request);
      const logout=session?`<button type="button" id="local-logout" data-csrf="${encodeURIComponent(session.csrfToken)}">Sair do CAEHUB</button>`:'';
      return reply.type('text/html').send(html.replace('href="/auth/login"',`href="/auth/login?returnTo=${encodeURIComponent(returnTo)}"`).replace('<a href="https://gabriel.honji.com.br/#solicitar-acesso">',`<a href="/auth/login?provider=google&amp;returnTo=${encodeURIComponent(returnTo)}">Entrar ou criar conta com Google</a>${logout}<a href="https://gabriel.honji.com.br/#solicitar-acesso">`));
    });app.get('/honji-access.css',async(_request,reply)=>reply.type('text/css').send(accessCss2.replace('.actions a{','.actions a,.actions button{').replace('.actions a:hover,','.actions a:hover,.actions button:hover,')+accessBrandCss));app.get('/honji-access.js',async(_request,reply)=>reply.type('application/javascript').send(accessScript+localLogoutScript));app.get('/favicon.svg',async(_request,reply)=>reply.type('image/svg+xml').send(giroFavicon));
    app.post('/api/debug-view',async(request,reply)=>{const actor=await this.current(request);if(!actor?.debugView?.available)return reply.code(403).send({error:'forbidden'});const mode=(request.body as any)?.mode;if(!debugModes.includes(mode))return reply.code(400).send({error:'invalid_request'});const sid=cookie(request,this.cookieName);await this.db.run('UPDATE caehub_sessions SET debug_mode=? WHERE session_hash=?',[mode,digest(sid!)]);return {mode};});
    app.get('/auth/login',async(request,reply)=>{
      const sid=randomBytes(32).toString('base64url'),state=randomBytes(32).toString('base64url'),nonce=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
      const query=request.query as Record<string,unknown>,returnTo=safeReturnTo(query.returnTo);
      const remembered=cookie(request,'honji_remember')==='1';
      if(query.provider!==undefined&&query.provider!=='google')return reply.code(400).send({error:'invalid_request'});
      await this.db.run('DELETE FROM caehub_sessions WHERE expires_at<=NOW(3)');
      await this.db.run('INSERT INTO caehub_sessions(session_hash,oauth_state_hash,oauth_nonce_hash,oauth_verifier,csrf_token,return_to,created_at,last_activity_at,expires_at) VALUES(?,?,?,?,?,?,NOW(3),NOW(3),DATE_ADD(NOW(3),INTERVAL 10 MINUTE))',[digest(sid),digest(state),digest(nonce),verifier,randomBytes(24).toString('base64url'),returnTo]);
      reply.header('set-cookie',`${this.cookieName}=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax`).redirect(`${this.config.issuer}/protocol/openid-connect/auth?${form({client_id:this.config.clientId,response_type:'code',redirect_uri:`${this.config.publicOrigin}/auth/callback`,scope:'openid profile email',state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',...(query.provider==='google'&&!remembered?{kc_idp_hint:'google'}:{})})}`);
    });
    app.get('/auth/callback',async(request,reply)=>{
      const query=request.query as Record<string,unknown>,sid=cookie(request,this.cookieName);
      if(!sid||typeof query.state!=='string'||(!query.error&&typeof query.code!=='string'))return loginFailurePage(reply,400,'Login inválido. Entre novamente com Honji.');
      // Claim and remove the pending transaction under a lock before contacting
      // the provider. Concurrent callbacks cannot reuse state or verifier.
      const pending=await this.db.transaction(async db=>{
        const value=await db.one<any>('SELECT oauth_nonce_hash AS nonceHash,oauth_verifier AS verifier,return_to AS returnTo FROM caehub_sessions WHERE session_hash=? AND oauth_state_hash=? AND subject IS NULL AND expires_at>NOW(3) FOR UPDATE',[digest(sid),digest(query.state as string)]);
        if(value)await db.run('DELETE FROM caehub_sessions WHERE session_hash=?',[digest(sid)]);
        return value;
      });
      if(!pending)return loginFailurePage(reply,400,'Login expirado. Entre novamente com Honji.');
      reply.header('set-cookie',`${this.cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
      if(query.error)return reply.redirect('/acesso?status=cancelled');
      let idToken:unknown;
      try {
        const response=await this.postIdentity('/protocol/openid-connect/token',form({grant_type:'authorization_code',client_id:this.config.clientId,client_secret:this.config.clientSecret,code:query.code as string,redirect_uri:`${this.config.publicOrigin}/auth/callback`,code_verifier:pending.verifier}));
        if(response.status>=500)throw unavailable();
        if(!response.ok)return loginFailurePage(reply,401,'Identidade inválida. Entre novamente com Honji.');
        idToken=(await response.json() as {id_token?:unknown}).id_token;
      } catch { throw unavailable(); }
      let payload;
      const keys:JWTVerifyGetKey=async(header,token)=>{
        try{return await this.jwks(header,token);}
        catch(error){if(error instanceof errors.JWKSNoMatchingKey)throw error;throw unavailable();}
      };
      try {
        if(typeof idToken!=='string')throw new Error('missing_id_token');
        ({payload}=await jwtVerify(idToken,keys,{issuer:this.config.issuer,audience:this.config.clientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat','nonce']}));
        if(!payload.sub||typeof payload.sid!=='string'||!payload.sid||typeof payload.nonce!=='string'||digest(payload.nonce)!==pending.nonceHash)throw new Error('identity_claims_invalid');
        if(Array.isArray(payload.aud)&&payload.aud.length>1&&payload.azp!==this.config.clientId)throw new Error('authorized_party_invalid');
        if(payload.azp!==undefined&&payload.azp!==this.config.clientId)throw new Error('authorized_party_invalid');
      } catch(error) { if(error instanceof AuthenticationFailure)throw error;return loginFailurePage(reply,401,'Identidade inválida. Entre novamente com Honji.'); }
      const newSid=randomBytes(32).toString('base64url');
      await this.db.run('INSERT INTO caehub_sessions(session_hash,subject,identity_session_id,display_name,csrf_token,created_at,last_activity_at,expires_at) VALUES(?,?,?,?,?,NOW(3),NOW(3),DATE_ADD(NOW(3),INTERVAL 12 HOUR))',[digest(newSid),payload.sub,payload.sid,String(payload.name??''),randomBytes(24).toString('base64url')]);
      reply.removeHeader('set-cookie');
      return reply.header('set-cookie',`${this.cookieName}=${newSid}; Path=/; HttpOnly; Secure; SameSite=Lax`).redirect(safeReturnTo(pending.returnTo));
    });
    // Local logout must remain possible after revocation or an authorization
    // outage. It validates the local session and CSRF without asking for access.
    app.post('/auth/logout',async(request,reply)=>{
      const session=await this.session(request);
      if(!session)throw new AuthenticationFailure(401,'session_required','Entre novamente para continuar.');
      if(request.headers.origin!==this.config.publicOrigin||request.headers['x-csrf-token']!==session.csrfToken)throw csrfFailure();
      const mode=(request.body as {mode?:unknown}|undefined)?.mode??'local';
      if(mode!=='local'&&mode!=='provider')return reply.code(400).send({error:'invalid_request'});
      await this.db.run('DELETE FROM caehub_sessions WHERE session_hash=?',[digest(cookie(request,this.cookieName)!)]);
      const redirect=mode==='local'?'/acesso':`${this.config.issuer}/protocol/openid-connect/logout?${form({client_id:this.config.clientId,post_logout_redirect_uri:`${this.config.publicOrigin}/acesso`})}`;
      return reply.header('set-cookie',`${this.cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`).send({redirect});
    });
  }
}
export function configuredGateway(env:NodeJS.ProcessEnv,db?:Database):IdentityGateway{
  if(env.NODE_ENV==='production'){if(!db)return new UnavailableHonjiGateway();const names=['PUBLIC_ORIGIN','OIDC_ISSUER','IDENTITY_INTERNAL_ORIGIN','OIDC_CLIENT_ID','OIDC_CLIENT_SECRET','AUTHORIZATION_SERVICE_CLIENT_ID','AUTHORIZATION_SERVICE_CLIENT_SECRET','AUTHORIZATION_SERVICE_ORIGIN','HONJI_ADMIN_ID'] as const;for(const name of names)if(!env[name])throw new Error(`${name}_missing`);const issuer=env.OIDC_ISSUER!;return new HonjiGateway(db,{publicOrigin:env.PUBLIC_ORIGIN!,issuer,identityOrigin:`${env.IDENTITY_INTERNAL_ORIGIN!}/realms/${issuer.split('/').at(-1)}`,clientId:env.OIDC_CLIENT_ID!,clientSecret:env.OIDC_CLIENT_SECRET!,serviceClientId:env.AUTHORIZATION_SERVICE_CLIENT_ID!,serviceClientSecret:env.AUTHORIZATION_SERVICE_CLIENT_SECRET!,authorizationOrigin:env.AUTHORIZATION_SERVICE_ORIGIN!,ownerId:env.HONJI_ADMIN_ID!});}
  if(env.NODE_ENV!=='development'&&env.NODE_ENV!=='test')return new UnavailableHonjiGateway();
  const subject=env.CAEHUB_DEV_ACTOR_ID;return new DevelopmentIdentityGateway(subject?{subject,displayName:env.CAEHUB_DEV_ACTOR_NAME??'Desenvolvedor CAEHUB',projectAccess:env.CAEHUB_DEV_PROJECT_ACCESS!=='false',owner:env.CAEHUB_DEV_OWNER==='true'}:undefined);
}
const localLogoutScript='(()=>{const button=document.querySelector("#local-logout");button?.addEventListener("click",async()=>{button.disabled=true;try{const response=await fetch("/auth/logout",{method:"POST",headers:{"x-csrf-token":decodeURIComponent(button.dataset.csrf)}});const result=await response.json();if(!response.ok)throw new Error();location.assign(result.redirect);}catch{button.disabled=false;button.textContent="Tentar sair novamente";}});})();';
const giroFavicon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>HONJI</title><circle cx="32" cy="32" r="32" fill="#145e63"/><g transform="translate(8 8) scale(.75)" fill="#F8F4ED"><path d="M28 28C10 26 6 18 13 10c6-7 20-5 24 3 4 7 0 12-9 15Z"/><path d="M28 28C10 26 6 18 13 10c6-7 20-5 24 3 4 7 0 12-9 15Z" transform="rotate(90 32 32)"/><path d="M28 28C10 26 6 18 13 10c6-7 20-5 24 3 4 7 0 12-9 15Z" transform="rotate(180 32 32)"/><path d="M28 28C10 26 6 18 13 10c6-7 20-5 24 3 4 7 0 12-9 15Z" transform="rotate(270 32 32)"/></g></svg>';
const accessPage='<!doctype html><html lang="pt-BR" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Acessar CAEHUB — Honji</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/honji-access.css"><script src="/honji-access.js" defer></script></head><body><header><div class="brands"><a class="honji" href="https://gabriel.honji.com.br" aria-label="HONJI, início"><span class="honji-symbol" aria-hidden="true"></span><strong>HONJI</strong></a><i aria-hidden="true"></i><a class="caecomp" href="/acesso"><span class="caecomp-symbol" aria-hidden="true"></span><span>CAECOMP<b>CAEHUB</b></span></a></div><button id="theme" type="button" aria-label="Ativar tema escuro"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.7 15.4A8.3 8.3 0 0 1 8.6 4.3 8.5 8.5 0 1 0 19.7 15.4Z"/></svg></button></header><main><section class="intro"><div class="eyebrow">01 / PROJETO PROTEGIDO</div><h1>Seu trabalho,<br><em>no contexto certo.</em></h1><p>O CAEHUB reúne gestão institucional, espaços e colaboração do CAECOMP.</p></section><section class="access-card"><div class="card-symbol"><span class="caecomp-symbol" aria-hidden="true"></span></div><div><span class="eyebrow">CONTA HONJI</span><h2>Entre para continuar.</h2><p>Use uma conta com acesso ao projeto CAECOMP. Seus espaços e ações serão mostrados conforme o seu vínculo.</p></div><div class="actions"><a class="primary" href="/auth/login">Entrar com Honji <span aria-hidden="true">→</span></a><a href="https://gabriel.honji.com.br/#solicitar-acesso">Solicitar acesso</a></div></section></main><footer><span>CAECOMP · UTFPR / APUCARANA</span><span>DESENVOLVIDO POR <a href="https://github.com/gabrielhonji">gabriel.honji</a></span></footer></body></html>';
const accessScript='(()=>{const root=document.documentElement,button=document.querySelector("#theme"),preference=()=>{const cookie=document.cookie.split(";").map(v=>v.trim()).find(x=>x.startsWith("honji_theme="))?.split("=")[1];if(["light","dark"].includes(cookie))return cookie;try{const saved=localStorage.getItem("honji-theme");return ["light","dark"].includes(saved)?saved:null;}catch{return null;}},icon=t=>t==="light"?"<path d=\\"M19.7 15.4A8.3 8.3 0 0 1 8.6 4.3 8.5 8.5 0 1 0 19.7 15.4Z\\"/>":"<circle cx=\\"12\\" cy=\\"12\\" r=\\"3.5\\"/><path d=\\"M11.25 1h1.5v3h-1.5zm0 19h1.5v3h-1.5zM1 11.25h3v1.5H1zm19 0h3v1.5h-3zM4.4 3.35l2.12 2.12-1.06 1.06-2.12-2.12zm13.08 13.08 2.12 2.12-1.06 1.06-2.12-2.12zM18.54 3.35l1.06 1.06-2.12 2.12-1.06-1.06zM5.46 16.43l1.06 1.06-2.12 2.12-1.06-1.06z\\"/>",set=(t,save=false)=>{root.dataset.theme=t;button.setAttribute("aria-label",`Ativar tema ${t==="light"?"escuro":"claro"}`);button.querySelector("svg").innerHTML=icon(t);if(save){try{localStorage.setItem("honji-theme",t);}catch{}const domain=location.hostname==="honji.com.br"||location.hostname.endsWith(".honji.com.br")?"; Domain=.honji.com.br":"";if(domain)document.cookie="honji_theme=; Path=/; Max-Age=0";document.cookie=`honji_theme=${t}${domain}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==="https:"?"; Secure":""}`;}};const sync=()=>set(preference()||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"));sync();addEventListener("focus",sync);matchMedia("(prefers-color-scheme: dark)").addEventListener("change",sync);button.addEventListener("click",()=>set(root.dataset.theme==="light"?"dark":"light",true));})();';
const accessCss=':root{color-scheme:light;--paper:#f8f4ed;--surface:#fffbf6;--text:#183b3d;--muted:#5c7372;--line:#c5d5cf;--accent:#145e63;--soft:#e8f0ec;--on-accent:#fffbf6;font-family:Arial,Helvetica,sans-serif}*{box-sizing:border-box}body{min-height:100vh;margin:0;padding:0 24px;background:var(--paper);color:var(--text);background-image:linear-gradient(color-mix(in srgb,var(--accent) 7%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--accent) 7%,transparent) 1px,transparent 1px);background-size:80px 80px}header{width:min(1120px,100%);min-height:88px;margin:auto;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;padding:0;color:var(--text);text-decoration:none;font:700 25px/1 Georgia,serif;letter-spacing:-1px}.brand .giro{width:29px;height:29px;background:currentColor;mask:url("/favicon.svg") center/contain no-repeat;-webkit-mask:url("/favicon.svg") center/contain no-repeat}.brand i{width:1px;height:28px;margin:0 4px;background:var(--line)}.brand>span:last-child{font:400 10px/1 Arial;letter-spacing:.2px}button,a{font:600 13px/1.4 Arial,Helvetica,sans-serif}#theme{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:112px;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);cursor:pointer;transition:background .16s,border-color .16s}.gate{width:min(1120px,100%);min-height:calc(100svh - 88px);margin:auto;padding:clamp(80px,13vw,164px) 0 84px;display:grid;align-content:start}.eyebrow{margin:0 0 20px;color:var(--accent);font-size:10px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase}.eyebrow:before{content:"01 / ";color:var(--muted)}h1{max-width:12ch;margin:0;font:400 clamp(56px,10vw,118px)/.9 Georgia,serif;letter-spacing:-6px}.lead{max-width:560px;margin-top:34px;font-size:18px;line-height:1.55;color:var(--text)}p:not(.lead){max-width:520px;margin:12px 0 0;color:var(--muted);font-size:14px;line-height:1.7}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:32px}.actions a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 17px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);text-decoration:none;transition:background .16s,border-color .16s,transform .16s}.actions .primary{border-color:var(--accent);background:var(--accent);color:var(--on-accent);gap:25px}.actions a:hover,#theme:hover{border-color:var(--accent);background:var(--soft);transform:translateY(-1px)}.actions .primary:hover{background:color-mix(in srgb,var(--accent) 86%,var(--text));color:var(--on-accent)}.note{margin-top:54px!important;padding-top:18px;border-top:1px solid var(--line);font-size:12px!important}:root[data-theme=dark]{color-scheme:dark;--paper:#151718;--surface:#1d2021;--text:#f0ede5;--muted:#b5bcba;--line:#3b4344;--accent:#65bea7;--soft:#263332;--on-accent:#151718}:root[data-theme=dark] .brand .giro{filter:brightness(1.35)}a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}@media(max-width:600px){body{padding:0 16px;background-size:56px 56px}header{min-height:72px}.brand strong{font-size:22px}.brand i,.brand>span:last-child{display:none}#theme{min-width:44px;width:44px;padding:0}#theme b{display:none}.gate{min-height:calc(100svh - 72px);padding:76px 0 54px}h1{font-size:clamp(56px,18vw,82px);letter-spacing:-4px}.lead{font-size:16px}}';
