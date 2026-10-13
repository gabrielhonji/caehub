import assert from 'node:assert/strict';
import test from 'node:test';
import { HonjiGateway } from './auth.js';

test('Honji gateway reuses only the technical token and checks user access on every request', async () => {
  const originalFetch=globalThis.fetch;
  let tokenRequests=0,decisionRequests=0;
  globalThis.fetch=async(input)=>{
    const url=String(input);
    if(url.includes('/protocol/openid-connect/token')){tokenRequests+=1;return Response.json({access_token:'technical-token',expires_in:60});}
    if(url.includes('/internal/authorization/decisions')){decisionRequests+=1;return Response.json({allowed:true,projectAccess:true});}
    throw new Error(`unexpected request: ${url}`);
  };
  try{
    const now=new Date();
    const db={one:async()=>({subject:'member',identitySessionId:'provider-session',displayName:'Member',csrfToken:'csrf',debugMode:'real',createdAt:now,lastActivity:now,expiresAt:new Date(now.getTime()+3600000)}),run:async()=>undefined};
    const gateway=new HonjiGateway(db as never,{publicOrigin:'https://caehub.example',issuer:'https://identity.example/realms/honji',identityOrigin:'https://identity-internal.example/realms/honji',clientId:'caehub',clientSecret:'secret',serviceClientId:'service',serviceClientSecret:'service-secret',authorizationOrigin:'https://authorization.example',ownerId:'owner'});
    const request={method:'GET',headers:{cookie:'__Host-caehub.sid=session'}} as never;
    assert.ok(await gateway.current(request));
    assert.ok(await gateway.current(request));
    assert.equal(tokenRequests,1);
    assert.equal(decisionRequests,2);
  }finally{globalThis.fetch=originalFetch;}
});
