import {useRef,useState,type Ref} from 'react';
import {refreshContent} from '../hooks/useRefresh';
import {Button} from './primitives';
export function RefreshButton({scope,label='Atualizar informações',disabled=false,onRefresh,buttonRef}:{scope?:string;label?:string;disabled?:boolean;onRefresh?:()=>Promise<unknown>;buttonRef?:Ref<HTMLButtonElement>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 return <span className="context-refresh"><Button ref={buttonRef} disabled={disabled||busy} aria-label={label} title={label} aria-busy={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const result=await(onRefresh?onRefresh():refreshContent(scope));if(result===false||Array.isArray(result)&&result.some(r=>r?.status==='rejected'))setError('Não foi possível atualizar. Tente novamente.');}catch{setError('Não foi possível atualizar. Tente novamente.');}finally{lock.current=false;setBusy(false);}}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14-5L3 9m0-6v6h6m-5 4a8 8 0 0 0 14 5l3-3m0 6v-6h-6"/></svg></Button>{error&&<span role="alert" className="refresh-error">{error}</span>}</span>;
}
