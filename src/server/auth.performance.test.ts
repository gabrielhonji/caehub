import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import { HonjiGateway } from './auth.js';

test('Honji gateway reuses only the technical token and checks user access on every request', async () => {
  const originalFetch=globalThis.fetch;
  let tokenRequests=0,decisionRequests=0;
  const identity=createServer(async(request,response)=>{
    assert.equal(request.headers.host,'identity.example');
    assert.equal(request.method,'POST');assert.equal(request.headers['content-type'],'application/x-www-form-urlencoded');
    let body='';for await(const chunk of request)body+=String(chunk);
    assert.equal(new URLSearchParams(body).get('grant_type'),'client_credentials');
    tokenRequests++;response.setHeader('content-type','application/json');response.end(JSON.stringify({access_token:'technical-token',expires_in:60}));
  });
  await new Promise<void>(resolve=>identity.listen(0,'127.0.0.1',resolve));
  const identityOrigin=`http://127.0.0.1:${(identity.address() as {port:number}).port}/realms/honji`;
  globalThis.fetch=async(input)=>{
    const url=String(input);
    if(url.includes('/internal/authorization/decisions')){decisionRequests+=1;return Response.json({allowed:true,projectAccess:true});}
    throw new Error(`unexpected request: ${url}`);
  };
  try{
    const now=new Date();
    const db={one:async()=>({subject:'member',identitySessionId:'provider-session',displayName:'Member',csrfToken:'csrf',debugMode:'real',createdAt:now,lastActivity:now,expiresAt:new Date(now.getTime()+3600000)}),run:async()=>undefined};
    const gateway=new HonjiGateway(db as never,{publicOrigin:'https://caehub.example',issuer:'https://identity.example/realms/honji',identityOrigin,clientId:'caehub',clientSecret:'fictitious',serviceClientId:'service',serviceClientSecret:'fictitious',authorizationOrigin:'https://authorization.example',ownerId:'owner'});
    const request={method:'GET',headers:{cookie:'__Host-caehub.sid=session'}} as never;
    assert.ok(await gateway.current(request));
    assert.ok(await gateway.current(request));
    assert.equal(tokenRequests,1);
    assert.equal(decisionRequests,2);
  }finally{globalThis.fetch=originalFetch;await new Promise<void>(resolve=>identity.close(()=>resolve()));}
});
