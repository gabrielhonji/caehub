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

const routePositions=new Map<string,number>();
export function useRouteScroll(route:string,ready:boolean){
 const previous=useState(()=>({route,first:true,history:false,clicked:false}))[0];
 useEffect(()=>{const save=()=>routePositions.set(previous.route,scrollY),click=(e:MouseEvent)=>{const a=(e.target as Element).closest?.('a[href]');if(a?.getAttribute('href')?.startsWith('#/'))previous.clicked=true;},pop=()=>{previous.history=!previous.clicked;};addEventListener('scroll',save,{passive:true});document.addEventListener('click',click,true);addEventListener('popstate',pop);return()=>{removeEventListener('scroll',save);document.removeEventListener('click',click,true);removeEventListener('popstate',pop);};},[]);
 useEffect(()=>{if(!ready)return;const old=previous.route,changed=old.split('?')[0]!==route.split('?')[0];if(!changed&&!previous.first){previous.route=route;previous.clicked=false;return;}const restore=previous.history?routePositions.get(route):undefined;previous.route=route;previous.first=false;previous.history=false;previous.clicked=false;const frame=requestAnimationFrame(()=>{const board=route.startsWith('#/espacos')?document.querySelector<HTMLElement>('.board-section'):null;const header=document.querySelector<HTMLElement>('.site-header');scrollTo({top:restore??(board?Math.max(0,board.getBoundingClientRect().top+scrollY-(header?.offsetHeight??0)-12):0),behavior:'instant'});dispatchEvent(new Event('caehub:navigation-scroll'));});return()=>cancelAnimationFrame(frame);},[route,ready]);
}
