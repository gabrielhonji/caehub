import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

// The issuer's vhost is trusted server configuration. Browser-compatible fetch
// discards Host, so use Node's native transport for the internal OIDC endpoint.
export function postIdentityForm(url:URL,issuerHost:string,form:URLSearchParams):Promise<Response>{
  if(!['http:','https:'].includes(url.protocol))throw new Error('invalid_identity_transport');
  const body=form.toString();
  return new Promise((resolve,reject)=>{
    const transport=url.protocol==='https:'?httpsRequest:httpRequest;
    const request=transport(url,{method:'POST',signal:AbortSignal.timeout(5000),headers:{host:issuerHost,'content-type':'application/x-www-form-urlencoded','content-length':Buffer.byteLength(body)}},response=>{
      const chunks:Buffer[]=[];let size=0;
      response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>4*1024*1024){response.destroy(new Error('identity_response_too_large'));return;}chunks.push(chunk);});
      response.once('error',reject);
      response.once('end',()=>{
        const headers=new Headers();
        for(const [name,value] of Object.entries(response.headers)){
          if(Array.isArray(value))for(const entry of value)headers.append(name,entry);
          else if(value!==undefined)headers.set(name,value);
        }
        try{const status=response.statusCode??503;resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks),{status,headers}));}catch(error){reject(error);}
      });
    });
    request.once('error',reject);request.end(body);
  });
}
