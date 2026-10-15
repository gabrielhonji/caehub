import { useEffect, useState } from 'react';
import type {Space} from '../domain/types';
import { api } from '../services/spaces';
import { Eyebrow, ErrorState, LoadingState } from './primitives';
type Department={id:string;name:string};
type Participant={membershipId:string;displayName:string;kind:'director'|'member'};
export function DepartmentsPage({active,spaces=[]}:{active?:string;spaces?:Space[]}) {
  const [departments,setDepartments]=useState<Department[]>([]),[participants,setParticipants]=useState<Participant[]>([]),[error,setError]=useState(false),[loading,setLoading]=useState(true);
  const load=async()=>{setLoading(true);setError(false);try{const rows=await api<Department[]>('/organization/departments');setDepartments(rows);if(active){const selected=rows.find(d=>d.id===active||d.name.toLowerCase().replaceAll('/', '-').replaceAll(' ', '-')===decodeURIComponent(active));setParticipants(selected?await api<Participant[]>(`/departments/${selected.id}/participants`):[]);}}catch{setError(true);}finally{setLoading(false);}};
  useEffect(()=>{void load();},[active]);
  if(loading)return <LoadingState/>;if(error)return <ErrorState onRetry={()=>void load()}/>;
  const selected=departments.find(d=>d.id===active||d.name.toLowerCase().replaceAll('/', '-').replaceAll(' ', '-')===decodeURIComponent(active??''));
  return <><section className="page-header"><Eyebrow>GESTÃO · DEPARTAMENTOS</Eyebrow><h1>{selected?.name??'Nossa organização'}.<br/><em>Responsabilidades compartilhadas.</em></h1><p>Os vínculos dão acesso automático aos espaços do departamento. A direção administra seus espaços e membros.</p><a className="button button-secondary" href="https://gabriel.honji.com.br/#acesso">Gerenciar estrutura no Honji ↗</a></section>
    {selected?<section className="state"><h2>Direção e membros</h2>{participants.length?<ul>{participants.map(p=><li key={p.membershipId}>{p.displayName} · {p.kind==='director'?'Direção':'Membro'}</li>)}</ul>:<p>Nenhum vínculo ativo neste departamento.</p>}<a href="#/departamentos">Todos os departamentos</a></section>:<section className="departments-page"><div className="departments-grid">{departments.map((d,index)=><article className={spaces.some(s=>s.department===d.name)?'department-accessible':''} key={d.id}><a className="department-card-link" href={spaces.find(s=>s.department===d.name)?`#/espacos/${spaces.find(s=>s.department===d.name)!.id}`:`#/departamentos/${d.id}`}><span>{String(index+1).padStart(2,'0')}</span><h2>{d.name}</h2><span>{spaces.some(s=>s.department===d.name)?'Abrir meu espaço →':'Ver direção e membros →'}</span></a></article>)}</div></section>}
  </>;
}
