import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Space } from '../domain/types';
import { createAvailability, createMeeting, deleteAvailability, getAgendaFoundation, getCollective, respondMeeting, updateAvailability, updateMeeting } from '../services/agenda';
import type { AgendaNotification, AvailabilityBlock, CalendarItem, CollectiveAvailability, DepartmentOption, MemberOption, Session } from '../services/agenda';
import { AccessDeniedState, Badge, Button, EmptyState, ErrorState, Eyebrow, LoadingState } from './primitives';
import { AvailabilityExceptions, TimetableImport } from './TimetableImport';
import { AvailabilityPlanning } from './AvailabilityPlanning';
import { readAgendaNotification, type ReviewRequest, type MeetingPoll, type OperationalShift } from '../services/agenda-advanced';
import { AgendaOperations } from './AgendaOperations';
import '../styles/agenda-advanced.css';

type View = 'week' | 'month';
type Scope = 'personal' | 'general' | 'workspace';
const daysLong = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const daysShort = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const two = (value:number) => String(value).padStart(2,'0');
const localKey = (value:Date) => `${value.getFullYear()}-${two(value.getMonth()+1)}-${two(value.getDate())}`;
const toLocalInput = (value:Date) => `${localKey(value)}T${two(value.getHours())}:${two(value.getMinutes())}`;
const startOfWeek = (value:Date) => { const result=new Date(value); result.setHours(0,0,0,0); result.setDate(result.getDate()-result.getDay()); return result; };
const addDays = (value:Date, amount:number) => { const result=new Date(value); result.setDate(result.getDate()+amount); return result; };
const dateTime = (value:string) => new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const time = (value:string) => new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const roleCanManage = (session?:Session) => Boolean(session?.owner || ['president','vice_president','counselor','director'].includes(session?.membership?.role ?? ''));
const noticeLabel:Record<string,string>={invited:'Convite',rescheduled:'Novo horário',removed:'Removido',availability_requested:'Revisar disponibilidade',availability_reviewed:'Revisão recebida',poll_invited:'Votação',poll_closed:'Votação encerrada',shift_assigned:'Turno atribuído',shift_accepted:'Aceite de turno',shift_declined:'Recusa de turno',shift_withdrawn:'Desistência',shift_cancelled:'Turno cancelado',shift_rescheduled:'Turno reagendado',shift_removed:'Participação removida'};

function CalendarEventCard({item,members,spaces,act}:{item:CalendarItem;members:MemberOption[];spaces:Space[];act:(work:()=>Promise<unknown>,message:string)=>Promise<void>}) {
  if(item.type==='unavailable') return <div className="calendar-event event-unavailable"><time>{time(item.startsAt)}</time><strong>{item.title}</strong><span>{item.recurring?'Semanal':'Exceção'}</span></div>;
  if(item.type==='shift')return <div className={`calendar-event event-shift ${item.response==='pending'?'shift-pending':''}`}><time>{time(item.startsAt)}–{time(item.endsAt)}</time><strong>{item.title}</strong><span>{item.workspace}</span><Badge tone={item.response==='pending'?'waiting':item.response==='confirmed'?'active':'neutral'}>{item.response==='pending'?'Reserva pendente':item.response==='confirmed'?'Turno confirmado':'Turno'}</Badge><span>Gerencie sua participação em Votações e turnos.</span></div>;
  const responseLabel={pending:'Pendente',confirmed:'Confirmado',maybe:'Talvez',declined:'Recusado'} as const;
  return <div className="calendar-event event-meeting">
    <time>{time(item.startsAt)}–{time(item.endsAt)}</time><strong>{item.title}</strong><span>{item.workspace||item.location||'Institucional'}</span>
    <details className="meeting-details"><summary>Ver detalhes</summary><dl><div><dt>Organização</dt><dd>{item.organizer}</dd></div><div><dt>Local</dt><dd>{item.location||'Não informado'}</dd></div><div><dt>Espaço</dt><dd>{item.workspace||'Institucional'}</dd></div></dl>{item.description&&<p>{item.description}</p>}</details>
    {item.response&&<Badge tone={item.response==='confirmed'?'active':item.response==='pending'?'waiting':'neutral'}>{responseLabel[item.response]}</Badge>}
    {item.response&&<div className="response-actions"><Button onClick={()=>void act(()=>respondMeeting(item.id,'confirmed'),'Presença confirmada.')}>Confirmar</Button><Button onClick={()=>void act(()=>respondMeeting(item.id,'maybe'),'Resposta atualizada.')}>Talvez</Button><Button onClick={()=>void act(()=>respondMeeting(item.id,'declined'),'Convite recusado.')}>Recusar</Button></div>}
    {item.canManage&&<details className="meeting-manager"><summary>Gerenciar reunião</summary><form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void act(()=>updateMeeting(item.id,{expectedRevision:Number(item.revision),title:String(data.get('title')),description:String(data.get('description')||''),location:String(data.get('location')||''),workspaceId:String(data.get('workspaceId')||'')||undefined,startsAt:new Date(String(data.get('startsAt'))).toISOString(),endsAt:new Date(String(data.get('endsAt'))).toISOString(),participantIds:data.getAll('participantIds').map(String)}),'Reunião e convites atualizados.');}}>
      <label>Título<input name="title" required maxLength={200} defaultValue={item.title}/></label><label>Descrição<textarea name="description" maxLength={10000} defaultValue={item.description}/></label><label>Local<input name="location" maxLength={255} defaultValue={item.location}/></label><label>Espaço<select name="workspaceId" defaultValue={item.workspaceId??''}><option value="">Institucional</option>{spaces.map(space=><option value={space.id} key={space.id}>{space.name}</option>)}</select></label><label>Início<input type="datetime-local" name="startsAt" required defaultValue={toLocalInput(new Date(item.startsAt))}/></label><label>Fim<input type="datetime-local" name="endsAt" required defaultValue={toLocalInput(new Date(item.endsAt))}/></label>
      <fieldset className="participant-picker"><legend>Convidados</legend>{members.map(member=><label key={member.id}><input type="checkbox" name="participantIds" value={member.id} defaultChecked={item.participantIds?.includes(member.id)}/><span>{member.displayName}</span></label>)}</fieldset><Button>Salvar reunião</Button>
    </form></details>}
  </div>;
}

export function AgendaPage({ spaces }:{spaces:Space[]}) {
  const [view,setView]=useState<View>('week');
  const [scope,setScope]=useState<Scope>('personal');
  const [workspaceId,setWorkspaceId]=useState(spaces[0]?.id ?? '');
  const [anchor,setAnchor]=useState(()=>new Date());
  const [items,setItems]=useState<CalendarItem[]>([]);
  const [blocks,setBlocks]=useState<AvailabilityBlock[]>([]);
  const [members,setMembers]=useState<MemberOption[]>([]);
  const [departments,setDepartments]=useState<DepartmentOption[]>([]);
  const [session,setSession]=useState<Session>();
  const [notifications,setNotifications]=useState<AgendaNotification[]>([]);
  const [requests,setRequests]=useState<ReviewRequest[]>([]);
  const [polls,setPolls]=useState<MeetingPoll[]>([]),[shifts,setShifts]=useState<OperationalShift[]>([]);
  const [collective,setCollective]=useState<CollectiveAvailability[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'|'denied'>('loading');
  const [feedback,setFeedback]=useState('');
  const [editing,setEditing]=useState<AvailabilityBlock>();
  const loaded=useRef(false);
  const canManage=roleCanManage(session);
  const range=useMemo(()=>{
    if(view==='week'){const from=startOfWeek(anchor);return {from,to:addDays(from,7)};}
    const from=new Date(anchor.getFullYear(),anchor.getMonth(),1);return {from,to:new Date(anchor.getFullYear(),anchor.getMonth()+1,1)};
  },[anchor,view]);
  const load=useCallback(async()=>{
    if(!loaded.current)setStatus('loading');
    try{
      const value=await getAgendaFoundation({from:range.from.toISOString(),to:range.to.toISOString(),scope,workspaceId:scope==='workspace'?workspaceId:undefined,offsetMinutes:String(range.from.getTimezoneOffset())});
      setItems(value.calendar);setBlocks(value.availability);setSession(value.session);setMembers(value.members);setDepartments(value.departments);setNotifications(value.notifications);setRequests(value.requests);setPolls(value.polls);setShifts(value.shifts);loaded.current=true;setStatus('ready');
    }catch(error){if(!loaded.current)setStatus(error instanceof Error&&error.message.toLowerCase().includes('required')?'denied':'error');}
  },[range.from.getTime(),range.to.getTime(),scope,workspaceId]);
  useEffect(()=>{void load();},[load]);
  const act=async(work:()=>Promise<unknown>,message:string)=>{setFeedback('');try{await work();setFeedback(message);setEditing(undefined);await load();}catch(error){setFeedback(error instanceof Error?error.message:'Não foi possível salvar.');}};
  const move=(amount:number)=>setAnchor(current=>view==='week'?addDays(current,amount*7):new Date(current.getFullYear(),current.getMonth()+amount,1));
  const calendarDays=useMemo(()=>{
    if(view==='week')return Array.from({length:7},(_,index)=>addDays(range.from,index));
    const gridStart=startOfWeek(range.from);return Array.from({length:42},(_,index)=>addDays(gridStart,index));
  },[range.from.getTime(),view]);
  const submitAvailability=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form),kind=String(data.get('kind')) as 'weekly'|'date';const input={kind,weekday:kind==='weekly'?Number(data.get('weekday')):undefined,date:kind==='date'?String(data.get('date')):undefined,startTime:String(data.get('startTime')),endTime:String(data.get('endTime')),note:String(data.get('note')||'')};void act(()=>editing?updateAvailability(editing.id,input):createAvailability(input),editing?'Indisponibilidade atualizada.':'Indisponibilidade cadastrada.').then(()=>form.reset());};
  const submitMeeting=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form);void act(()=>createMeeting({title:String(data.get('title')),description:String(data.get('description')||''),location:String(data.get('location')||''),workspaceId:String(data.get('workspaceId')||'')||undefined,startsAt:new Date(String(data.get('startsAt'))).toISOString(),endsAt:new Date(String(data.get('endsAt'))).toISOString(),participantIds:data.getAll('participantIds').map(String)}),'Reunião criada e convites enviados.').then(()=>form.reset());};
  const collectiveDefaults={from:toLocalInput(range.from),to:toLocalInput(range.to)};
  if(status==='loading')return <LoadingState/>;
  if(status==='error')return <ErrorState onRetry={load}/>;
  if(status==='denied')return <AccessDeniedState/>;
  return <>
    <section className="agenda-heading"><div><Eyebrow>AGENDA · CAECOMP</Eyebrow><h1>Tempo compartilhado,<br/><em>com privacidade.</em></h1><p>Consulte seus compromissos, os calendários autorizados dos espaços e a agenda institucional sem duplicar eventos.</p></div><aside><Eyebrow>SEU CONTEXTO</Eyebrow><strong>{canManage?'Direção e organização':'Participação'}</strong><p>Detalhes particulares nunca aparecem na consulta coletiva.</p></aside></section>
    {notifications.length>0&&<section className="agenda-notifications" aria-labelledby="agenda-notifications-title"><div><Eyebrow>ATUALIZAÇÕES</Eyebrow><h2 id="agenda-notifications-title">Convites e mudanças recentes</h2></div><ul>{notifications.map(notification=><li key={notification.id}><Badge tone={notification.priority==='high'?'waiting':'neutral'}>{notification.priority==='high'?'Prioritário · ':''}{noticeLabel[notification.kind]??'Atualização'}</Badge><strong>{notification.title}</strong><time>{dateTime(notification.createdAt)}</time>{notification.readAt?<span>Lida</span>:<Button onClick={()=>void act(()=>readAgendaNotification(notification.id),'Notificação marcada como lida.')}>Marcar como lida</Button>}</li>)}</ul></section>}
    {feedback&&<p className="form-feedback" role="status">{feedback}</p>}
    <section className="calendar-section" aria-labelledby="calendar-title">
      <div className="agenda-controls"><div><Eyebrow>CALENDÁRIO</Eyebrow><h2 id="calendar-title">{range.from.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2></div><div className="calendar-switch" role="group" aria-label="Visualização"><Button aria-pressed={view==='week'} onClick={()=>setView('week')}>Semana</Button><Button aria-pressed={view==='month'} onClick={()=>setView('month')}>Mês</Button></div></div>
      <div className="calendar-toolbar"><div className="scope-controls"><label>Agenda<select value={scope} onChange={event=>setScope(event.target.value as Scope)}><option value="personal">Minha agenda</option><option value="general">Agenda geral</option><option value="workspace">Calendário do espaço</option></select></label>{scope==='workspace'&&<label>Espaço<select value={workspaceId} onChange={event=>setWorkspaceId(event.target.value)}>{spaces.map(space=><option value={space.id} key={space.id}>{space.name}</option>)}</select></label>}</div><div className="calendar-navigation"><Button onClick={()=>move(-1)} aria-label="Período anterior">←</Button><Button onClick={()=>setAnchor(new Date())}>{view==='week'?'Semana atual':'Mês atual'}</Button><Button onClick={()=>move(1)} aria-label="Próximo período">→</Button></div></div>
      <div className={`functional-calendar ${view==='month'?'functional-month':''}`} role="grid" aria-label="Compromissos do período">{calendarDays.map(day=>{const daily=items.filter(item=>localKey(new Date(item.startsAt))===localKey(day));const outside=view==='month'&&day.getMonth()!==anchor.getMonth();const today=localKey(day)===localKey(new Date());return <article role="gridcell" aria-current={today?'date':undefined} className={`functional-day ${outside?'month-outside':''} ${today?'is-today':''}`} key={day.toISOString()}><header><span>{daysShort[day.getDay()]}</span><strong>{day.getDate()}</strong></header>{daily.map(item=><CalendarEventCard item={item} members={members} spaces={spaces} act={act} key={`${item.type}-${item.id}-${item.startsAt}`}/>)}</article>})}</div>
      {!items.length&&<EmptyState title="Nenhum compromisso neste período.">Use os controles acima para consultar outra semana, mês ou calendário.</EmptyState>}
    </section>
    <section className="agenda-workflows">
      <TimetableImport onSaved={load}/>
      <AvailabilityPlanning members={members} departments={departments} requests={requests} canManage={canManage} membershipId={session?.membership?.id} onSaved={load}/>
      <AgendaOperations polls={polls} shifts={shifts} members={members} spaces={spaces} canManage={canManage} onSaved={load}/>
      <article className="agenda-panel"><Eyebrow>MINHA DISPONIBILIDADE</Eyebrow><h2>Registre quando você não pode participar.</h2><form className="agenda-form" onSubmit={submitAvailability} key={editing?.id??'new'}><label>Tipo<select name="kind" defaultValue={editing?.kind??'weekly'}><option value="weekly">Compromisso semanal</option><option value="date">Exceção por data</option></select></label><label>Dia da semana<select name="weekday" defaultValue={editing?.weekday??1}>{daysLong.map((day,index)=><option value={index} key={day}>{day}</option>)}</select></label><label>Data da exceção<input type="date" name="date" defaultValue={editing?.date}/></label><label>Início<input type="time" name="startTime" required defaultValue={editing?.startTime??'08:00'}/></label><label>Fim<input type="time" name="endTime" required defaultValue={editing?.endTime??'09:00'}/></label><label className="wide-field">Nota privada<input name="note" maxLength={255} defaultValue={editing?.note??''}/></label><div className="form-actions"><Button variant="primary">{editing?'Salvar edição':'Adicionar indisponibilidade'}</Button>{editing&&<Button type="button" onClick={()=>setEditing(undefined)}>Cancelar</Button>}</div></form><ul className="availability-list">{blocks.map(block=><li key={block.id}><div><strong>{block.kind==='weekly'?daysLong[Number(block.weekday)]:new Date(`${block.date}T12:00:00`).toLocaleDateString('pt-BR')}</strong><span>{block.startTime}–{block.endTime}{block.note?` · ${block.note}`:''}</span></div><div><Button onClick={()=>setEditing(block)}>Editar</Button><Button onClick={()=>void act(()=>deleteAvailability(block.id),'Indisponibilidade removida.')}>Remover</Button></div><AvailabilityExceptions block={block} act={act}/></li>)}</ul>{!blocks.length&&<p className="privacy-note">Sem informações cadastradas — isso não será tratado como disponibilidade confirmada.</p>}</article>
      {canManage?<article className="agenda-panel"><Eyebrow>NOVA REUNIÃO</Eyebrow><h2>Convide participantes com contexto.</h2><form className="agenda-form" onSubmit={submitMeeting}><label className="wide-field">Título<input name="title" required maxLength={200}/></label><label className="wide-field">Descrição<textarea name="description" maxLength={10000}/></label><label>Início<input name="startsAt" type="datetime-local" required/></label><label>Fim<input name="endsAt" type="datetime-local" required/></label><label>Local<input name="location" maxLength={255}/></label><label>Espaço<select name="workspaceId"><option value="">Institucional</option>{spaces.map(space=><option value={space.id} key={space.id}>{space.name}</option>)}</select></label><fieldset className="participant-picker"><legend>Participantes</legend>{members.map(member=><label key={member.id}><input type="checkbox" name="participantIds" value={member.id}/><span>{member.displayName}</span></label>)}</fieldset><Button variant="primary">Criar reunião</Button></form></article>:<article className="agenda-panel"><AccessDeniedState/></article>}
    </section>
    {canManage&&<section className="collective-panel"><div><Eyebrow>DISPONIBILIDADE COLETIVA</Eyebrow><h2>Livre, ocupado ou não informado.</h2><p>O resultado não inclui títulos, notas ou descrições particulares.</p></div><form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget),from=new Date(String(data.get('from')));void act(async()=>setCollective(await getCollective({from:from.toISOString(),to:new Date(String(data.get('to'))).toISOString(),departmentId:String(data.get('departmentId')||'')||undefined,membershipIds:data.getAll('membershipIds').map(String).join(',')||undefined,offsetMinutes:String(from.getTimezoneOffset())})),'Consulta coletiva atualizada.');}}><label>De<input name="from" type="datetime-local" required defaultValue={collectiveDefaults.from}/></label><label>Até<input name="to" type="datetime-local" required defaultValue={collectiveDefaults.to}/></label><label>Departamento<select name="departmentId"><option value="">Todos</option>{departments.map(department=><option value={department.id} key={department.id}>{department.name}</option>)}</select></label><fieldset className="participant-picker"><legend>Pessoas (opcional)</legend>{members.map(member=><label key={member.id}><input type="checkbox" name="membershipIds" value={member.id}/><span>{member.displayName}</span></label>)}</fieldset><Button>Consultar</Button></form><div className="collective-results" aria-live="polite">{collective.map(person=><article key={person.membershipId}><strong>{person.displayName}</strong><Badge tone={person.status==='free'?'active':person.status==='busy'?'waiting':'neutral'}>{person.status==='free'?'Livre':person.status==='busy'?'Ocupado':'Não informado'}</Badge></article>)}</div></section>}
  </>;
}
