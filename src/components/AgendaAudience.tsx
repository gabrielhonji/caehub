import {ParticipantCheckbox} from "./ParticipantCheckbox";
import {DepartmentPicker} from './DepartmentPicker';
import {Button} from './primitives';
import {useEffect,useState,useRef} from 'react';
import {getWorkspaceDetail} from '../services/spaces';
import type {Space} from '../domain/types';
import type {MemberOption,DepartmentOption} from '../services/agenda';

export function AgendaAudience({spaces,members,initialWorkspace='',selectedIds,departments=[]}:{spaces:Space[];members:MemberOption[];departments?:DepartmentOption[];initialWorkspace?:string;selectedIds?:string[]}){
 const [departmentIds,setDepartmentIds]=useState<string[]>([]),[workspace,setWorkspace]=useState(initialWorkspace);
 const [selected,setSelected]=useState<string[]>(selectedIds??[]),[loading,setLoading]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const initial=useRef(true),workspaceControl=useRef<HTMLSelectElement>(null);
 useEffect(()=>{let active=true;setError('');setLoading(Boolean(workspace));if(!workspace){initial.current=false;return;}void getWorkspaceDetail(workspace).then(detail=>{if(!active)return;const ids=detail.participants.map(p=>p.membershipId);setSelected(old=>[...new Set([...old,...ids])]);initial.current=false;}).catch(()=>{if(active)setError('Não foi possível consultar a equipe. Tente novamente.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[workspace,attempt]);
 useEffect(()=>{workspaceControl.current?.setCustomValidity(loading?'Aguarde o carregamento da equipe.':error);},[loading,error]);
 const visible=members.filter(m=>!departmentIds.length||m.departmentIds?.some(id=>departmentIds.includes(id)));
 return <><label>Espaço responsável<select ref={workspaceControl} name="workspaceId" value={workspace} onChange={e=>{initial.current=false;setWorkspace(e.target.value);}}><option value="">Institucional</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><p className="wide-field availability-hint">Ao escolher um espaço, sua equipe entra na seleção. Filtros e trocas de contexto preservam quem já foi convidado.</p>{loading&&<p role="status">Consultando equipe…</p>}{error&&<p role="alert">{error}<Button type="button" onClick={()=>setAttempt(n=>n+1)}>Tentar novamente</Button></p>}{departments.length>0&&<DepartmentPicker departments={departments} selected={departmentIds} description="Selecionar um departamento adiciona seus integrantes; desmarcar apenas remove o filtro." onChange={ids=>{const added=ids.filter(id=>!departmentIds.includes(id));setDepartmentIds(ids);if(added.length)setSelected(old=>[...new Set([...old,...members.filter(member=>member.departmentIds?.some(id=>added.includes(id))).map(member=>member.id)])]);}}/>}
 <fieldset disabled={loading||Boolean(error)} className="participant-picker"><legend>Convidados</legend>{members.map(m=><ParticipantCheckbox hidden={!visible.includes(m)} key={m.id} name="participantIds" value={m.id} checked={selected.includes(m.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,m.id]:old.filter(id=>id!==m.id))} displayName={m.displayName}/>)}</fieldset><p className="wide-field participant-count">{selected.length} selecionados · {visible.length} exibidos · {selected.filter(id=>!visible.some(m=>m.id===id)).length} fora do filtro</p></>;
}
