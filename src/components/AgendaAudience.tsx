import {useEffect,useState,useRef} from 'react';
import {getWorkspaceDetail} from '../services/spaces';
import type {Space} from '../domain/types';
import type {MemberOption} from '../services/agenda';
export function AgendaAudience({spaces,members,initialWorkspace='',selectedIds}:{spaces:Space[];members:MemberOption[];initialWorkspace?:string;selectedIds?:string[]}){
 const changedWorkspace=useRef(false);
 const [workspace,setWorkspace]=useState(initialWorkspace),[ids,setIds]=useState<string[]>([]),[selected,setSelected]=useState<string[]>(selectedIds??[]),[error,setError]=useState('');
 useEffect(()=>{let active=true;setError('');if(!workspace){setIds(members.map(m=>m.id));setSelected(selectedIds??[]);return;}setIds([]);setSelected([]);void getWorkspaceDetail(workspace).then(detail=>{if(!active)return;const allowed=[...new Set([...detail.participants.map(p=>p.membershipId),...members.filter(m=>['president','vice_president','counselor'].includes(m.role)).map(m=>m.id)])];setIds(allowed);setSelected(changedWorkspace.current?allowed:selectedIds??allowed);}).catch(()=>{if(active)setError('Não foi possível consultar a equipe deste espaço. Selecione novamente.');});return()=>{active=false;};},[workspace,members]);
 return <><label>Espaço<select name="workspaceId" value={workspace} onChange={e=>{changedWorkspace.current=true;setWorkspace(e.target.value);}}><option value="">Institucional</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{error&&<p role="alert">{error}</p>}<fieldset className="participant-picker"><legend>Participantes {workspace?'do espaço e cargos institucionais':''}</legend>{members.filter(m=>ids.includes(m.id)).map(m=><label key={m.id}><input type="checkbox" name="participantIds" value={m.id} checked={selected.includes(m.id)} onChange={e=>setSelected(previous=>e.target.checked?[...previous,m.id]:previous.filter(id=>id!==m.id))}/><span>{m.displayName}</span></label>)}</fieldset></>;
}
