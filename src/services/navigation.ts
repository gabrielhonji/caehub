import {useEffect,useState} from 'react';

export function useRouteQuery() {
  const [hash,setHash]=useState(location.hash);
  useEffect(()=>{const update=()=>setHash(location.hash);addEventListener('hashchange',update);return()=>removeEventListener('hashchange',update);},[]);
  const query=new URLSearchParams(hash.split('?')[1]??'');
  const update=(patch:Record<string,string|undefined>,replace=false)=>{
    const next=new URLSearchParams(location.hash.split('?')[1]??'');
    for(const [key,value] of Object.entries(patch))value?next.set(key,value):next.delete(key);
    const target=location.hash.split('?')[0]+(next.size?'?'+next.toString():'');
    if(target===location.hash)return;
    if(replace){history.replaceState(null,'',target);dispatchEvent(new HashChangeEvent('hashchange'));}else location.hash=target;
  };
  return {query,update};
}
export function skipToContent(event:{preventDefault:()=>void}) {
  event.preventDefault();
  const main=document.getElementById('content');
  main?.focus();main?.scrollIntoView({block:'start'});
}
export const taskReturnRoute=()=>{
  const from=new URLSearchParams(location.hash.split('?')[1]??'').get('from');
  return from&&/^#\/minhas-tarefas(?:\?|$)/.test(from)?from:'#/minhas-tarefas';
};
const positions=new Map<string,number>();
export const rememberTaskPosition=()=>positions.set(location.hash,scrollY);
export const taskPosition=()=>positions.get(location.hash)??0;
