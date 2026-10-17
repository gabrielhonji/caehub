import {useEffect,useRef} from 'react';
let pending:Promise<unknown>|undefined;
export function refreshContent(){if(pending)return pending;const tasks:Promise<unknown>[]=[];window.dispatchEvent(new CustomEvent('caehub:refresh',{detail:tasks}));pending=Promise.allSettled(tasks).finally(()=>{pending=undefined;});return pending;}
export function useRefresh(load:()=>Promise<unknown>){const latest=useRef(load);latest.current=load;useEffect(()=>{const refresh=(e:Event)=>{const work=latest.current();(e as CustomEvent<Promise<unknown>[]>).detail.push(work);};window.addEventListener('caehub:refresh',refresh);return()=>window.removeEventListener('caehub:refresh',refresh);},[]);}
