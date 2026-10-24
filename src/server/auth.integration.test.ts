import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { HonjiGateway, configuredGateway, safeReturnTo } from './auth.js';
import { connect, configFromEnv, migrate } from './database.js';
import { InstitutionalService } from './service.js';
import { buildApp } from './app.js';

test('Honji BFF validates callbacks, rotates sessions and enforces live authorization at the API',async t=>{
  const db=await connect(configFromEnv(process.env));await migrate(db);
  const {privateKey,publicKey}=await generateKeyPair('RS256');
  const jwk={...await exportJWK(publicKey),kid:'test-key',alg:'RS256',use:'sig'};
  let tokenResponse:(form:URLSearchParams)=>Promise<Response>,keysUnavailable=false;
  const server=createServer(async(req,res)=>{
    res.setHeader('content-type','application/json');
    if(req.url?.endsWith('/token')){
      let body='';for await(const chunk of req)body+=String(chunk);
      const response=await tokenResponse(new URLSearchParams(body));res.statusCode=response.status;res.end(await response.text());
    }else if(keysUnavailable){res.statusCode=503;res.end('{"error":"private provider details"}');}else res.end(JSON.stringify({keys:[jwk]}));
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const issuer=`http://127.0.0.1:${(server.address() as {port:number}).port}/realms/honji`;
  const origin='https://caehub.example',subject=randomUUID();
  const config={publicOrigin:origin,issuer,identityOrigin:issuer,clientId:'caehub',clientSecret:'fictitious',serviceClientId:'service',serviceClientSecret:'fictitious',authorizationOrigin:'https://authorization.example',ownerId:randomUUID()};
  const gateway=new HonjiGateway(db,config);
  const app=buildApp(new InstitutionalService(db),gateway);
  const originalFetch=globalThis.fetch;
  let decision:'allow'|'deny'|'suspended'|'unavailable'|'malformed'|'loggedout'='allow',projectAccess=true,nonce='',tokenVariant='valid',tokenCalls=0,decisionCalls=0;
  tokenResponse=async(form)=>{
      if(form.get('grant_type')==='client_credentials')return Response.json({access_token:'technical-test-token',expires_in:60});
      tokenCalls++;
      assert.ok(form.get('code_verifier'));
      if(tokenVariant==='unavailable')return new Response('private infrastructure details',{status:503});
      if(tokenVariant==='invalid')return new Response('',{status:400});
      const signed=await new SignJWT({nonce:tokenVariant==='nonce'?'wrong':nonce,name:'Pessoa fictícia',sid:'provider-session'})
        .setProtectedHeader({alg:'RS256',kid:'test-key'}).setSubject(subject).setIssuer(tokenVariant==='issuer'?'wrong':issuer)
        .setAudience(tokenVariant==='audience'?'wrong':'caehub').setIssuedAt().setExpirationTime(tokenVariant==='expired'?'0s':'5m').sign(privateKey);
      return Response.json({id_token:tokenVariant==='signature'?signed.slice(0,-10)+'tampered00':signed,access_token:'never-expose-this',refresh_token:'never-expose-refresh'});
  };
  globalThis.fetch=async(input,init)=>{
    const url=String(input);
    if(url.endsWith('/internal/authorization/decisions')){
      decisionCalls++;
      assert.deepEqual(JSON.parse(init?.body as string),{integrationId:'caehub',userId:subject,identitySessionId:'provider-session',resource:{projectId:'CAECOMP'},action:'account.access'});
      if(decision==='unavailable')throw new Error('private infrastructure details');
      if(decision==='suspended')return new Response('',{status:403});
      if(decision==='loggedout')return Response.json({error:'identity_session_expired'},{status:401});
      if(decision==='malformed')return Response.json({allowed:'true'});
      return Response.json({allowed:decision==='allow',projectAccess,studentEmailVerified:false});
    }
    return originalFetch(input,init);
  };
  const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
  const login=async(returnTo='/#/meus-pedidos')=>{
    const response=await app.inject(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    assert.equal(response.statusCode,302);
    const url=new URL(response.headers.location!);nonce=url.searchParams.get('nonce')!;
    assert.equal(url.searchParams.get('code_challenge_method'),'S256');
    assert.equal(url.searchParams.get('response_type'),'code');
    assert.equal(url.searchParams.has('prompt'),false,'ordinary Honji login preserves SSO');
    const cookie=String(response.headers['set-cookie']).split(';')[0];
    assert.match(String(response.headers['set-cookie']),/HttpOnly; Secure; SameSite=Lax/);
    return {cookie,state:url.searchParams.get('state')!};
  };
  const googleLogin=await app.inject('/auth/login?provider=google');
  const googleAuthorization=new URL(googleLogin.headers.location!);
  assert.equal(googleAuthorization.searchParams.get('kc_idp_hint'),'google');
  const rememberedGoogleLogin=await app.inject({method:'GET',url:'/auth/login?provider=google',headers:{cookie:'honji_remember=1'}});
  assert.equal(new URL(rememberedGoogleLogin.headers.location!).searchParams.get('kc_idp_hint'),null);
  assert.equal(googleAuthorization.searchParams.has('prompt'),false,'Google login must allow an existing remembered SSO session');
  const callback=({cookie,state}:{cookie:string;state:string})=>app.inject({url:`/auth/callback?code=fictitious&state=${state}`,headers:{cookie}});
  try{
    await t.test('invalid state and cancelled login cannot create a session',async()=>{
      const pending=await login();
      assert.equal((await callback({...pending,state:'forged'})).statusCode,400);
      const cancelled=await app.inject({url:`/auth/callback?error=access_denied&state=${pending.state}`,headers:{cookie:pending.cookie}});
      assert.equal(cancelled.statusCode,302);assert.equal(cancelled.headers.location,'/acesso?status=cancelled');
      assert.equal((await callback(pending)).statusCode,400);
    });
    await t.test('issuer, audience, nonce, expiry and signature are mandatory',async()=>{
      for(const variant of ['issuer','audience','nonce','expired','signature','invalid']){
        tokenVariant=variant;const pending=await login();
        assert.equal((await callback(pending)).statusCode,401,variant);
        assert.equal((await callback(pending)).statusCode,400,'consumed even when validation fails');
      }
      tokenVariant='unavailable';const failure=await callback(await login());
      assert.equal(failure.statusCode,503);assert.ok(!failure.body.includes('private infrastructure'));
      tokenVariant='valid';
    });
    await t.test('successful concurrent callbacks consume state once and rotate the cookie',async()=>{
      const pending=await login(),before=tokenCalls;
      const results=await Promise.all([callback(pending),callback(pending)]);
      assert.deepEqual(results.map(r=>r.statusCode).sort(),[302,400]);assert.equal(tokenCalls,before+1);
      const success=results.find(r=>r.statusCode===302)!;
      assert.equal(success.headers.location,'/#/meus-pedidos');
      const cookie=String(success.headers['set-cookie']).split(';')[0];assert.notEqual(cookie,pending.cookie);
      assert.equal((await app.inject({url:'/api/me',headers:{cookie:pending.cookie}})).statusCode,401);
      const me=await app.inject({url:'/api/me',headers:{cookie}});assert.equal(me.statusCode,200);assert.equal(me.json().subject,subject);
      assert.equal(me.headers['cache-control'],'no-store');assert.ok(!me.body.includes('never-expose'));assert.equal(me.json().membership,null);
      assert.equal((await app.inject({url:'/api/foundation',headers:{cookie,'x-user-id':'owner','x-role':'president'}})).statusCode,403,'no membership from project access or forged headers');
      const person=randomUUID();await db.run('INSERT INTO people(id,honji_subject,display_name) VALUES(?,?,?)',[person,subject,'Pessoa fictícia']);
      await db.run("INSERT INTO memberships(id,organization_id,person_id,role,status) VALUES(?,'1a4e0bd0-5f4a-4d10-8000-000000000001',?,'member','active')",[randomUUID(),person]);
      assert.equal((await app.inject({url:'/api/foundation',headers:{cookie}})).statusCode,200);
      projectAccess=false;assert.equal((await app.inject({url:'/api/foundation',headers:{cookie}})).statusCode,403,'revoked grant rejects next operation with the same cookie');projectAccess=true;
      const csrf=me.json().csrfToken;
      const headers={cookie,origin,'x-csrf-token':csrf};
      assert.equal((await app.inject({method:'POST',url:'/api/commercial/my-orders',headers:{cookie,origin},payload:{}})).json().error,'csrf_invalid');
      assert.equal((await app.inject({method:'POST',url:'/auth/logout',headers:{...headers,origin:'https://attacker.example'}})).statusCode,403);
      const beforeDecision=decisionCalls;decision='deny';
      assert.equal((await app.inject({url:'/api/me',headers:{cookie}})).json().error,'access_denied');
      assert.equal(decisionCalls,beforeDecision+1,'fresh authorization despite local cookie');
      const publicStatus=await app.inject({url:'/api/public/buyer-status',headers:{cookie}});assert.equal(publicStatus.statusCode,200);assert.deepEqual(publicStatus.json(),{canBuy:false,sessionDenied:true});
      const access=await app.inject({url:'/acesso',headers:{cookie}});assert.equal(access.statusCode,200);assert.ok(access.body.includes('id="local-logout"'));assert.ok(access.body.includes('data-csrf="'+csrf+'"'));assert.ok(!access.body.includes('never-expose'));
      decision='suspended';assert.equal((await app.inject({url:'/api/foundation',headers:{cookie}})).statusCode,403);
      decision='unavailable';assert.equal((await app.inject({url:'/api/me',headers:{cookie}})).statusCode,503);
      decision='malformed';assert.equal((await app.inject({url:'/api/me',headers:{cookie}})).statusCode,503);
      const count=decisionCalls;
      const logout=await app.inject({method:'POST',url:'/auth/logout',headers});
      assert.equal(logout.statusCode,200);assert.equal(logout.json().redirect,'/acesso?status=logged_out');assert.equal(decisionCalls,count);
      assert.equal((await app.inject({url:'/api/me',headers:{cookie}})).statusCode,401);
      decision='allow';
    });
    await t.test('idle and absolute session expiry reject protected requests',async()=>{
      for(const [expiry,code] of [['last_activity_at=DATE_SUB(NOW(3),INTERVAL 8 HOUR)','session_idle_expired'],['expires_at=DATE_SUB(NOW(3),INTERVAL 1 SECOND)','session_absolute_expired']]){
        const response=await callback(await login()),cookie=String(response.headers['set-cookie']).split(';')[0];
        await db.run(`UPDATE caehub_sessions SET ${expiry} WHERE session_hash=?`,[digest(cookie.split('=')[1])]);
        const expired=await app.inject({url:'/api/me',headers:{cookie}});assert.equal(expired.statusCode,401);assert.equal(expired.json().error,code);
      }
    });
    await t.test('global provider logout invalidates a still-present local cookie',async()=>{
      const response=await callback(await login()),cookie=String(response.headers['set-cookie']).split(';')[0];
      assert.equal((await app.inject({url:'/api/me',headers:{cookie}})).statusCode,200);
      decision='loggedout';assert.equal((await app.inject({url:'/api/me',headers:{cookie}})).statusCode,401);decision='allow';
      assert.equal((await app.inject({url:'/api/me',headers:{cookie}})).statusCode,401);
    });
    await t.test('unavailable provider keys are distinct from an invalid signed token',async()=>{
      const pending=await login(),fresh=buildApp(new InstitutionalService(db),new HonjiGateway(db,config));keysUnavailable=true;
      try{const response=await fresh.inject({url:`/auth/callback?code=fictitious&state=${pending.state}`,headers:{cookie:pending.cookie}});assert.equal(response.statusCode,503);assert.ok(!response.body.includes('private provider details'));}
      finally{keysUnavailable=false;await fresh.close();}
    });
  }finally{globalThis.fetch=originalFetch;await app.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await db.close();}
});

test('development identities require an explicit development or test environment',async()=>{
  for(const NODE_ENV of ['production','staging',undefined])assert.equal(await configuredGateway({NODE_ENV,CAEHUB_DEV_ACTOR_ID:'fictitious',CAEHUB_DEV_OWNER:'true'}).current(),undefined);
  assert.equal((await configuredGateway({NODE_ENV:'development',CAEHUB_DEV_ACTOR_ID:'fictitious'}).current())?.subject,'fictitious');
  const production=configuredGateway({NODE_ENV:'production',CAEHUB_DEV_ACTOR_ID:'fictitious',CAEHUB_DEV_OWNER:'true',PUBLIC_ORIGIN:'https://caehub.example',OIDC_ISSUER:'https://identity.example/realms/honji',IDENTITY_INTERNAL_ORIGIN:'https://identity-internal.example',OIDC_CLIENT_ID:'caehub',OIDC_CLIENT_SECRET:'fictitious',AUTHORIZATION_SERVICE_CLIENT_ID:'service',AUTHORIZATION_SERVICE_CLIENT_SECRET:'fictitious',AUTHORIZATION_SERVICE_ORIGIN:'https://authorization.example',HONJI_ADMIN_ID:randomUUID()},{} as never);
  assert.ok(production instanceof HonjiGateway);assert.equal(await production.current({method:'GET',headers:{'x-user-id':'fictitious','x-role':'owner'}} as never),undefined);
});
test('return destinations cannot leave the application or loop through authentication',()=>{
  for(const value of ['https://attacker.example','//attacker.example','/\\attacker.example','/auth/login','/acesso','/\nattacker',null])assert.equal(safeReturnTo(value),'/');
  assert.equal(safeReturnTo('/#/meus-pedidos'),'/#/meus-pedidos');
});
