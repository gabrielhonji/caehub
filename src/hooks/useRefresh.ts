import {useEffect,useRef} from 'react';
type Subscription={scope:string;load:()=>Promise<unknown>;last:number;pending?:Promise<unknown>};
const subscriptions=new Set<Subscription>();let stop:undefined|(()=>void),lastActivity=Date.now();
function run(item:Subscription){if(item.pending)return item.pending;item.last=Date.now();item.pending=Promise.resolve().then(item.load).finally(()=>{item.pending=undefined;});return item.pending;}
export function refreshContent(scope?:string){return Promise.allSettled([...subscriptions].filter(item=>!scope||item.scope===scope).map(run));}
function start(){if(stop)return;const editing=()=>Boolean(document.querySelector('dialog[open]'))||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName??'');
 const tick=()=>{if(document.hidden||navigator.onLine===false||Date.now()-lastActivity>120000||editing())return;for(const item of subscriptions){const interval=item.scope==='board'?15000:item.scope==='notifications'||item.scope==='catalog'?60000:30000;if(Date.now()-item.last>=interval)void run(item).catch(()=>{});}};
 const resume=()=>{if(document.hidden)return;lastActivity=Date.now();tick();};const activity=()=>{const idle=Date.now()-lastActivity>120000;lastActivity=Date.now();if(idle)tick();};
 const timer=setInterval(tick,5000);document.addEventListener('visibilitychange',resume);addEventListener('focus',resume);addEventListener('online',resume);document.addEventListener('pointerdown',activity,{passive:true});document.addEventListener('keydown',activity);document.addEventListener('wheel',activity,{passive:true});
 stop=()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume);removeEventListener('focus',resume);removeEventListener('online',resume);document.removeEventListener('pointerdown',activity);document.removeEventListener('keydown',activity);document.removeEventListener('wheel',activity);stop=undefined;};
}
export function useRefresh(load:()=>Promise<unknown>,scope='page',enabled=true){const latest=useRef(load);latest.current=load;useEffect(()=>{if(!enabled)return;const item:Subscription={scope,last:Date.now(),load:()=>latest.current()};subscriptions.add(item);start();return()=>{subscriptions.delete(item);if(!subscriptions.size)stop?.();};},[scope,enabled]);}
