import {useRef,useState} from 'react';
import {refreshContent} from '../hooks/useRefresh';
import {Button} from './primitives';
export function RefreshButton({scope,label='Atualizar informações',disabled=false,onRefresh}:{scope?:string;label?:string;disabled?:boolean;onRefresh?:()=>Promise<unknown>}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');const lock=useRef(false);
 return <span className="context-refresh"><Button disabled={disabled||busy} aria-label={label} title={label} aria-busy={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setNotice('');try{const result=await(onRefresh?onRefresh():refreshContent(scope));if(result===false||Array.isArray(result)&&result.some(r=>r?.status==='rejected'))setNotice('Falha na atualização. Tente novamente.');else setNotice('Consulta concluída.');}catch{setNotice('Falha na atualização. Tente novamente.');}finally{lock.current=false;setBusy(false);}}}><span aria-hidden="true">{busy?'…':'↻'}</span></Button><span role="status" className="refresh-status">{notice}</span></span>;
}
