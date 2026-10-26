import {useEffect,useMemo,useRef,useState} from 'react';
import {ParticipantCheckbox} from './ParticipantCheckbox';
import {DepartmentPicker} from './DepartmentPicker';
import {Button} from './primitives';
import {getWorkspaceDetail} from '../services/spaces';
import type {Space} from '../domain/types';
import type {MemberOption,DepartmentOption} from '../services/agenda';

export function AgendaAudience({spaces,members,initialWorkspace='',selectedIds,departments=[]}:{spaces:Space[];members:MemberOption[];departments?:DepartmentOption[];initialWorkspace?:string;selectedIds?:string[]}){
 const [departmentIds,setDepartmentIds]=useState<string[]>([]),[workspace,setWorkspace]=useState(initialWorkspace);
 const [selected,setSelected]=useState<string[]>(selectedIds??[]),[workspaceDerived,setWorkspaceDerived]=useState<string[]>([]);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const workspaceControl=useRef<HTMLSelectElement>(null);
 useEffect(()=>{let active=true;setError('');setLoading(Boolean(workspace));setWorkspaceDerived([]);if(!workspace)return;void getWorkspaceDetail(workspace).then(detail=>{if(active)setWorkspaceDerived(detail.participants.map(p=>p.membershipId));}).catch(()=>{if(active)setError('Não foi possível consultar a equipe. Tente novamente.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[workspace,attempt]);
 useEffect(()=>{workspaceControl.current?.setCustomValidity(loading?'Aguarde o carregamento da equipe.':error);},[loading,error]);
 const departmentDerived=useMemo(()=>members.filter(member=>member.departmentIds?.some(id=>departmentIds.includes(id))).map(member=>member.id),[departmentIds,members]);
 const effective=useMemo(()=>[...new Set([...selected,...workspaceDerived,...departmentDerived])],[selected,workspaceDerived,departmentDerived]);
 const visible=members.filter(member=>!departmentIds.length||['president','vice_president'].includes(member.role)||member.departmentIds?.some(id=>departmentIds.includes(id)));
 return <><label>Espaço responsável<select ref={workspaceControl} name="workspaceId" value={workspace} onChange={event=>setWorkspace(event.target.value)}><option value="">Institucional</option>{spaces.map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label><p className="wide-field availability-hint">Ao escolher um espaço, sua equipe entra na seleção. Presidente e vice continuam disponíveis sem seleção automática.</p>{loading&&<p role="status">Consultando equipe…</p>}{error&&<p role="alert">{error}<Button type="button" onClick={()=>setAttempt(value=>value+1)}>Tentar novamente</Button></p>}{departments.length>0&&<DepartmentPicker departments={departments} selected={departmentIds} description="Selecionar um departamento adiciona seus integrantes; desmarcar retira os convidados derivados dele." onChange={setDepartmentIds}/>}<fieldset disabled={loading||Boolean(error)} className="participant-picker"><legend>Convidados</legend>{members.map(member=><ParticipantCheckbox hidden={!visible.includes(member)} key={member.id} name="participantIds" value={member.id} checked={effective.includes(member.id)} onChange={event=>setSelected(current=>event.target.checked?[...new Set([...current,member.id])]:current.filter(id=>id!==member.id))} displayName={member.displayName}/>)}</fieldset><p className="wide-field participant-count">{effective.length} selecionados · {visible.length} exibidos · {effective.filter(id=>!visible.some(member=>member.id===id)).length} fora do filtro</p></>;
}
