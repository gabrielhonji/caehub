import {RefreshButton} from './RefreshButton';
import {requestReview} from '../services/agenda-advanced';
import {useRefresh} from '../hooks/useRefresh';
import {DateInput} from './DateInput';
import {useRouteQuery} from '../services/navigation';
import {dateRange} from '../domain/date-format';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Space } from '../domain/types';
import { createAvailability, createMeeting, deleteAvailability, getAgendaFoundation, respondMeeting, updateAvailability, updateMeeting } from '../services/agenda';
import type { AvailabilityBlock, CalendarItem, DepartmentOption, MemberOption, Session } from '../services/agenda';
import { AccessDeniedState, Badge, Button, Toast, Dialog, EmptyState, ErrorState, Eyebrow, LoadingState } from './primitives';
import { AvailabilityExceptions, TimetableImport } from './TimetableImport';
import { AvailabilityPlanning } from './AvailabilityPlanning';
import { type ReviewRequest, type MeetingPoll, type OperationalShift } from '../services/agenda-advanced';
import { AgendaOperations } from './AgendaOperations';
import { MeetingInbox } from './MeetingInbox';
import { AgendaAudience } from './AgendaAudience';
import { AgendaTimeFields } from './AgendaTimeFields';
import { AgendaSummary, AgendaWorkflow } from './AgendaWorkflow';
import '../styles/agenda-advanced.css';

type View = 'week' | 'month';
type Scope = 'personal' | 'general' | 'workspace';
const daysLong = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const daysShort = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const two = (value:number) => String(value).padStart(2,'0');
const localKey = (value:Date) => `${value.getFullYear()}-${two(value.getMonth()+1)}-${two(value.getDate())}`;
const startOfWeek = (value:Date) => { const result=new Date(value); result.setHours(0,0,0,0); result.setDate(result.getDate()-result.getDay()); return result; };
const addDays = (value:Date, amount:number) => { const result=new Date(value); result.setDate(result.getDate()+amount); return result; };
const dateTime = (value:string) => new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const time = (value:string) => new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const roleCanManage = (session?:Session) => Boolean(session?.canManage ?? (session?.owner || ['president','vice_president','director'].includes(session?.membership?.role ?? '')));

function CalendarEventCard({item,members,spaces,act,feedback,busy,day,departments=[]}:{departments?:DepartmentOption[];day?:Date;feedback:string;busy:boolean;item:CalendarItem;members:MemberOption[];spaces:Space[];act:(work:()=>Promise<unknown>,message:string)=>Promise<unknown>}) {
  const [open,setOpen]=useState(false);
  const [responding,setResponding]=useState<'confirmed'|'maybe'|'declined'>();
  useEffect(()=>{const check=()=>{const query=new URLSearchParams(location.hash.split('?')[1]);if(query.get('resource')===item.id)setOpen(true);};check();window.addEventListener('hashchange',check);return()=>window.removeEventListener('hashchange',check);},[item.id]);
  const dayEnd=day?addDays(day,1):undefined;
  const continuesBefore=Boolean(day&&new Date(item.startsAt)<day),continuesAfter=Boolean(dayEnd&&new Date(item.endsAt)>dayEnd);
  const interval=<div className="calendar-event-time" aria-label={`Início: ${dateTime(item.startsAt)}. Fim: ${dateTime(item.endsAt)}.`}>{day?<><time dateTime={item.startsAt}>{continuesBefore?'Desde o dia anterior':time(item.startsAt)}</time><span aria-hidden="true">–</span><time dateTime={item.endsAt}>{continuesAfter?'Continua no dia seguinte':time(item.endsAt)}</time></>:<strong className="meeting-date">{new Date(item.startsAt).toLocaleDateString('pt-BR',{weekday:'short'})} · {dateRange(item.startsAt,item.endsAt)}</strong>}</div>;
  if(item.type==='unavailable') return <div className="calendar-event event-unavailable"><small className="calendar-event-kind">◷ Indisponibilidade</small>{interval}<strong>{item.title}</strong><span>{item.recurring?'Semanal':'Exceção'}</span></div>;
  if(item.type==='shift')return <div className={`calendar-event event-shift ${item.response==='pending'?'shift-pending':''}`}><small className="calendar-event-kind">▤ Turno</small>{interval}<strong>{item.title}</strong><span>{item.workspace}</span><Badge tone={item.response==='pending'?'waiting':item.response==='confirmed'?'active':'neutral'}>{item.response==='pending'?'Reserva pendente':item.response==='confirmed'?'Turno confirmado':'Turno'}</Badge><span>Gerencie sua participação em Votações e turnos.</span></div>;
  const responseLabel={pending:'Pendente',confirmed:'Confirmado',maybe:'Talvez',declined:'Recusado'} as const;
  return <div className="calendar-event event-meeting">
    <small className="calendar-event-kind">◉ Reunião</small>{interval}<strong>{item.title}</strong><span>{item.workspace||item.location||'Institucional'}</span>
    {item.response&&<Badge tone={item.response==='confirmed'?'active':item.response==='pending'?'waiting':'neutral'}>{responseLabel[item.response]}</Badge>}<Button aria-label={`Ver reunião: ${item.title}`} onClick={()=>setOpen(true)}>Ver reunião</Button><AgendaWorkflow busy={busy} title={item.title} open={open} onClose={()=>setOpen(false)}>{feedback&&<p role="alert">{feedback}</p>}<div className="meeting-details"><p className="meeting-date"><strong>{new Date(item.startsAt).toLocaleDateString('pt-BR',{weekday:'long'})} · {dateRange(item.startsAt,item.endsAt)}</strong></p><dl><div><dt>Organização</dt><dd>{item.organizer}</dd></div><div><dt>Local</dt><dd>{item.location||'Não informado'}</dd></div><div><dt>Espaço</dt><dd>{item.workspace||'Institucional'}</dd></div></dl>{item.description&&<p>{item.description}</p>}</div>
    {item.response&&<Badge tone={item.response==='confirmed'?'active':item.response==='pending'?'waiting':'neutral'}>{responseLabel[item.response]}</Badge>}
    {item.response&&!item.archivedAt&&<div className="response-actions"><Button variant={item.response==='confirmed'?'primary':'secondary'} aria-pressed={item.response==='confirmed'} onClick={()=>setResponding('confirmed')}>✓ Vou participar</Button><Button aria-pressed={item.response==='maybe'} onClick={()=>setResponding('maybe')}>? Talvez</Button><Button aria-pressed={item.response==='declined'} onClick={()=>setResponding('declined')}>× Não vou</Button></div>}
    {responding&&<Dialog title={`Responder à reunião · ${responseLabel[responding]}`} onClose={()=>setResponding(undefined)}><div className="meeting-response-tools"><RefreshButton scope="meetings" label="Atualizar respostas"/></div>{responding!=='confirmed'&&item.responses?.some(response=>response.response===responding)&&<ul className="meeting-response-summary">{item.responses.filter(response=>response.response===responding).map((response,index)=><li key={index}><strong>{response.displayName}</strong>{response.justification&&<p>{response.justification}</p>}</li>)}</ul>}<form className="agenda-form" onSubmit={event=>{event.preventDefault();const justification=responding==='confirmed'?undefined:String(new FormData(event.currentTarget).get('justification'));void act(()=>respondMeeting(item.id,responding,justification),responding==='confirmed'?'Presença confirmada.':'Resposta e justificativa registradas.').then(ok=>{if(ok)setResponding(undefined);});}}>{responding!=='confirmed'&&<label className="wide-field">Justificativa para {responding==='maybe'?'talvez':'recusa'}<textarea name="justification" required maxLength={1000}/></label>}<div className="form-actions"><Button variant="primary">Confirmar resposta</Button><Button type="button" onClick={()=>setResponding(undefined)}>Cancelar</Button></div></form></Dialog>}
    {item.canManage&&!item.archivedAt&&<details className="meeting-manager"><summary>Gerenciar reunião</summary><form key={item.revision} onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void act(()=>updateMeeting(item.id,{expectedRevision:Number(item.revision),title:String(data.get('title')),description:String(data.get('description')||''),location:String(data.get('location')||''),workspaceId:String(data.get('workspaceId')||'')||undefined,startsAt:new Date(String(data.get('startsAt'))).toISOString(),endsAt:new Date(String(data.get('endsAt'))).toISOString(),participantIds:data.getAll('participantIds').map(String)}),'Reunião e convites atualizados.');}}>
      <label>Título<input name="title" required maxLength={200} defaultValue={item.title}/></label><label>Descrição<textarea name="description" maxLength={10000} defaultValue={item.description}/></label><label>Local<input name="location" maxLength={255} defaultValue={item.location}/></label><AgendaTimeFields startsAt={item.startsAt} endsAt={item.endsAt}/>
      <AgendaAudience spaces={spaces} members={members} departments={departments} initialWorkspace={item.workspaceId} selectedIds={item.participantIds}/>
      <Button>Salvar reunião</Button>
    </form></details>}</AgendaWorkflow>
  </div>;
}

export function AgendaPage({ spaces }:{spaces:Space[]}) {
  const {query,update}=useRouteQuery();
  const view:View=query.get('view')==='month'?'month':'week';
  const scope:Scope=query.get('scope')==='general'?'general':query.get('scope')==='workspace'?'workspace':'personal';
  const workspaceId=spaces.some(space=>space.id===query.get('workspace'))?query.get('workspace')!:spaces[0]?.id??'';
  const rawDate=query.get('date');const parsed=rawDate&&/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?new Date(rawDate+'T12:00:00'):new Date();
  const anchor=Number.isNaN(parsed.getTime())?new Date():parsed;
  const setView=(value:View)=>update({view:value});
  const setScope=(value:Scope)=>update({scope:value});
  const setWorkspaceId=(value:string)=>update({workspace:value});
  const setAnchor=(value:Date|((current:Date)=>Date))=>update({date:localKey(typeof value==='function'?value(anchor):value)});
  const [items,setItems]=useState<CalendarItem[]>([]);
  const [blocks,setBlocks]=useState<AvailabilityBlock[]>([]);
  const [members,setMembers]=useState<MemberOption[]>([]);
  const [departments,setDepartments]=useState<DepartmentOption[]>([]);
  const [recommendedDepartmentId,setRecommendedDepartmentId]=useState(''),[recommendedWorkspaceId,setRecommendedWorkspaceId]=useState('');
  const [session,setSession]=useState<Session>();
  const [requests,setRequests]=useState<ReviewRequest[]>([]);
  const [polls,setPolls]=useState<MeetingPoll[]>([]),[shifts,setShifts]=useState<OperationalShift[]>([]);
  const requestedTab=query.get('tab'),kind=query.get('kind');
  const tab=['calendar','meetings','availability','operations'].includes(requestedTab??'')?requestedTab:query.get('resource')?(kind==='poll'||kind==='shift'||kind==='opinion'?'operations':kind==='availability_request'?'availability':'meetings'):'calendar';
  const setTab=(value:string)=>update({tab:value,resource:undefined,kind:undefined,edit:undefined,plan:undefined});
  const [selectedDay,setSelectedDay]=useState<string>();
  const [meetingReview,setMeetingReview]=useState(false);
  const [schedule,setSchedule]=useState<{start:string;end:string;ids:string[]}>();
  const meetingReturn=useRef<(()=>void)|undefined>(undefined);
  const reviewReturn=useRef<(()=>void)|undefined>(undefined);
  const closeAvailability=()=>{setAvailabilityOpen(false);const resume=reviewReturn.current;reviewReturn.current=undefined;resume?.();};
  const [availabilityOpen,setAvailabilityOpen]=useState(false),[meetingOpen,setMeetingOpen]=useState(false),[meetingDraft,setMeetingDraft]=useState(0);
  useEffect(()=>{if(query.get('edit')==='availability')setAvailabilityOpen(true);},[query.get('edit')]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'|'denied'>('loading');
  const [feedback,setFeedback]=useState(''),[confirmation,setConfirmation]=useState(''),[saving,setSaving]=useState(false);
  const [editing,setEditing]=useState<AvailabilityBlock>();
  const [deleting,setDeleting]=useState<AvailabilityBlock>();
  const [availabilityKind,setAvailabilityKind]=useState<'weekly'|'date'>('weekly');
  const loaded=useRef(false),generation=useRef(0);
  const canManage=roleCanManage(session);
  const range=useMemo(()=>{
    if(view==='week'){const from=startOfWeek(anchor);return {from,to:addDays(from,7)};}
    const from=new Date(anchor.getFullYear(),anchor.getMonth(),1);return {from,to:new Date(anchor.getFullYear(),anchor.getMonth()+1,1)};
  },[anchor,view]);
  const load=useCallback(async()=>{
    const current=++generation.current;
    if(!loaded.current)setStatus('loading');
    try{
      const value=await getAgendaFoundation({from:range.from.toISOString(),to:range.to.toISOString(),scope,workspaceId:scope==='workspace'?workspaceId:undefined,offsetMinutes:String(range.from.getTimezoneOffset())});
      if(current!==generation.current)return;
      setItems(value.calendar);setBlocks(value.availability);setSession(value.session);setMembers(value.members);setDepartments(value.departments);setRecommendedDepartmentId(value.recommendedDepartmentId??'');setRecommendedWorkspaceId(value.recommendedWorkspaceId??'');setRequests(value.requests);setPolls(value.polls);setShifts(value.shifts);loaded.current=true;setStatus('ready');
    }catch(error){if(current!==generation.current)return;if(!loaded.current)setStatus(error instanceof Error&&error.message.toLowerCase().includes('required')?'denied':'error');}
  },[range.from.getTime(),range.to.getTime(),scope,workspaceId]);
  useRefresh(load,'agenda');
  useEffect(()=>{void load();},[load,query.get('resource')]);
  const mutationLock=useRef(false);
  const act=async(work:()=>Promise<unknown>,message:string)=>{if(mutationLock.current)return false;mutationLock.current=true;setSaving(true);setFeedback('');setConfirmation('');try{await work();setConfirmation(message);await load();return true;}catch(error){setFeedback(error instanceof Error?error.message:'Não foi possível salvar.');return false;}finally{mutationLock.current=false;setSaving(false);}};
  const move=(amount:number)=>setAnchor(current=>view==='week'?addDays(current,amount*7):new Date(current.getFullYear(),current.getMonth()+amount,1));
  const calendarDays=useMemo(()=>{
    if(view==='week')return Array.from({length:7},(_,index)=>addDays(range.from,index));
    const gridStart=startOfWeek(range.from);return Array.from({length:Math.ceil((range.from.getDay()+new Date(range.from.getFullYear(),range.from.getMonth()+1,0).getDate())/7)*7},(_,index)=>addDays(gridStart,index));
  },[range.from.getTime(),view]);
  const submitAvailability=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form),kind=String(data.get('kind')) as 'weekly'|'date';const input={kind,weekday:kind==='weekly'?Number(data.get('weekday')):undefined,date:kind==='date'?String(data.get('date')):undefined,startTime:String(data.get('startTime')),endTime:String(data.get('endTime')),note:String(data.get('note')||'')};void act(()=>editing?updateAvailability(editing.id,input):createAvailability(input),editing?'Indisponibilidade atualizada.':'Indisponibilidade cadastrada.').then(saved=>{if(saved){form.reset();setEditing(undefined);setAvailabilityKind('weekly');}});};
  const submitMeeting=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form);const startsAt=new Date(String(data.get('startsAt'))),endsAt=new Date(String(data.get('endsAt')));const participantIds=data.getAll('participantIds').map(String);const reviewTo=new Date(startsAt);reviewTo.setDate(reviewTo.getDate()+7);void act(()=>meetingReview?requestReview({title:String(data.get('title')),from:startsAt.toISOString(),to:reviewTo.toISOString(),workspaceId:String(data.get('workspaceId')||'')||undefined,participantIds}):createMeeting({title:String(data.get('title')),description:String(data.get('description')||''),location:String(data.get('location')||''),workspaceId:String(data.get('workspaceId')||'')||undefined,startsAt:new Date(String(data.get('startsAt'))).toISOString(),endsAt:new Date(String(data.get('endsAt'))).toISOString(),participantIds:data.getAll('participantIds').map(String)}),meetingReview?'Revisão solicitada. A reunião ainda não foi criada.':'Reunião criada e convites enviados.').then(saved=>{if(saved){setMeetingOpen(false);setSchedule(undefined);setTab(meetingReview?'availability':'meetings');setMeetingReview(false);}});};
  if(status==='loading')return <LoadingState/>;
  if(status==='error')return <ErrorState onRetry={load}/>;
  if(status==='denied')return <AccessDeniedState/>;
  return <><Toast message={confirmation}/>
    <section className="agenda-heading agenda-heading-compact"><div><Eyebrow>AGENDA · CAECOMP</Eyebrow><h1>Agenda.</h1><p>Calendário, reuniões e disponibilidade em um lugar.</p></div></section>
    <nav className="agenda-tabs" aria-label="Áreas da agenda">{[['calendar','Calendário'],['meetings','Reuniões'],['availability','Disponibilidade'],['operations','Votações e turnos']].map(([id,label])=><Button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</Button>)}</nav>
    {tab==='calendar'&&<div><section className="calendar-section" aria-labelledby="calendar-title">
      <div className="agenda-controls"><div><Eyebrow>CALENDÁRIO</Eyebrow><h2 id="calendar-title">{range.from.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2></div><div className="calendar-header-actions"><div className="calendar-switch" role="group" aria-label="Visualização"><Button aria-pressed={view==='week'} onClick={()=>setView('week')}>Semana</Button><Button aria-pressed={view==='month'} onClick={()=>setView('month')}>Mês</Button></div><RefreshButton scope="agenda" label={view==='week'?'Atualizar calendário semanal':'Atualizar calendário mensal'}/></div></div>
      <div className="calendar-toolbar"><div className="scope-controls"><label>Agenda<select value={scope} onChange={event=>setScope(event.target.value as Scope)}><option value="personal">Minha agenda</option><option value="general">Agenda geral</option><option value="workspace">Calendário do espaço</option></select></label>{scope==='workspace'&&<label>Espaço<select value={workspaceId} onChange={event=>setWorkspaceId(event.target.value)}>{spaces.map(space=><option value={space.id} key={space.id}>{space.name}</option>)}</select></label>}</div><div className="calendar-navigation"><Button onClick={()=>move(-1)} aria-label="Período anterior">←</Button><Button onClick={()=>setAnchor(new Date())}>{view==='week'?'Semana atual':'Mês atual'}</Button><Button onClick={()=>move(1)} aria-label="Próximo período">→</Button></div></div>
      <div className="calendar-scroll"><div className={`functional-calendar ${view==='month'?'functional-month':''}`} role="grid" aria-label="Compromissos do período">{calendarDays.map(day=>{const daily=items.filter(item=>new Date(item.startsAt)<addDays(day,1)&&new Date(item.endsAt)>day);const outside=view==='month'&&day.getMonth()!==anchor.getMonth();const today=localKey(day)===localKey(new Date());return <article role="gridcell" aria-current={today?'date':undefined} className={`functional-day ${outside?'month-outside':''} ${today?'is-today':''} ${day.getDay()===0||day.getDay()===6?'is-weekend':''}`} key={day.toISOString()}><header><span>{daysShort[day.getDay()]}</span><strong>{day.getDate()}</strong></header><Button className="button button-secondary calendar-day-open" aria-label={`Ver ${daily.length} compromissos de ${day.toLocaleDateString('pt-BR',{day:'numeric',month:'long'})}`} onClick={()=>setSelectedDay(localKey(day))}>{daily.length?<><strong>{daily.length}</strong><span aria-hidden="true"> •</span></>:'—'}</Button><div className="calendar-events">{daily.map(item=><CalendarEventCard day={day} item={item} members={members} spaces={spaces} departments={departments} act={act} feedback={feedback} busy={saving} key={`${item.type}-${item.id}-${item.startsAt}`}/>)}</div>{!daily.length&&<p className="calendar-day-empty">Sem compromissos</p>}</article>})}</div></div>
      {!items.length&&<EmptyState title="Nenhum compromisso neste período.">Use os controles acima para consultar outra semana, mês ou calendário.</EmptyState>}
    </section>
    </div>}{tab==='meetings'&&<MeetingInbox onChanged={load} render={meeting=><CalendarEventCard item={meeting} members={members} spaces={spaces} departments={departments} act={act} feedback={feedback} busy={saving}/>}/>}<section hidden={tab!=='availability'&&(tab!=='meetings'||!canManage)} className="agenda-tools" aria-labelledby="agenda-tools-title"><div className="agenda-section-heading"><div><Eyebrow>PLANEJAR E PARTICIPAR</Eyebrow><h2 id="agenda-tools-title">{tab==='meetings'?'Organizar reunião':'Meus horários'}</h2></div></div>
    <div className="agenda-workflows">
      <div hidden={tab!=='availability'}><AgendaSummary eyebrow="MINHA DISPONIBILIDADE" title="Meus horários" description={blocks.length?`${blocks.length} intervalos cadastrados. Ajuste compromissos e libere ocorrências específicas.`:'Informe seus compromissos semanais ou por data. Ausência de cadastro não confirma disponibilidade.'}><Button onClick={()=>setAvailabilityOpen(true)}>Gerenciar disponibilidade</Button></AgendaSummary></div>
      <div hidden={tab!=='availability'} className="academic-summary"><TimetableImport onSaved={load}/></div>
      {canManage&&tab==='meetings'&&<AgendaSummary eyebrow="REUNIÕES" title="Já tenho um horário" description="Defina os detalhes e envie os convites."><Button onClick={()=>{setFeedback('');setSchedule(undefined);setMeetingDraft(n=>n+1);setMeetingOpen(true);}}>Criar reunião</Button></AgendaSummary>}
      <div hidden={tab!=='availability'&&tab!=='meetings'}><AvailabilityPlanning spaces={spaces} openQuery={query.get('plan')==='find'} onEditAvailability={resume=>{reviewReturn.current=resume;setAvailabilityOpen(true);}} onSchedule={(start,end,ids,resume)=>{setFeedback('');setSchedule({start,end,ids});meetingReturn.current=resume;setMeetingDraft(n=>n+1);setMeetingOpen(true);}} members={members} departments={departments} requests={requests} canManage={canManage} canRead={tab==='meetings'&&(canManage||session?.canReadAll===true)} membershipId={session?.membership?.id} onSaved={load}/></div>
    </div>{tab==='availability'&&!blocks.some(b=>b.term)&&<aside className="academic-banner"><strong>Cadastre ou importe sua grade acadêmica.</strong><span>Suas aulas ajudam a equipe a encontrar horários para reuniões sem conflitos.</span></aside>}</section>
    <AgendaWorkflow busy={saving} title="Meus horários" open={availabilityOpen} headerActions={reviewReturn.current&&<Button onClick={closeAvailability}>← Voltar à revisão</Button>} onClose={closeAvailability}><p role="status">{feedback}</p><form className="agenda-form" onSubmit={submitAvailability} key={editing?.id??'new'}><label>Tipo<select name="kind" value={availabilityKind} onChange={e=>setAvailabilityKind(e.target.value as 'weekly'|'date')}><option value="weekly">Compromisso semanal</option><option value="date">Exceção por data</option></select></label>{availabilityKind==='weekly'?<label>Dia da semana<select name="weekday" defaultValue={editing?.weekday??1}>{daysLong.map((day,index)=><option value={index} key={day}>{day}</option>)}</select></label>:<label>Data da exceção<DateInput name="date" required defaultValue={editing?.date}/></label>}<AgendaTimeFields withDate={false} startName="startTime" endName="endTime" startDefault={editing?.startTime??''} endDefault={editing?.endTime??''}/><label className="wide-field">Nota privada<input name="note" maxLength={255} defaultValue={editing?.note??''}/></label><div className="form-actions"><Button variant="primary">{editing?'Salvar edição':'Adicionar indisponibilidade'}</Button>{editing&&<Button type="button" onClick={()=>{setEditing(undefined);setAvailabilityKind('weekly');}}>Cancelar</Button>}</div></form><ul className="availability-list">{blocks.map(block=><li key={block.id}><div className="availability-heading"><strong>{block.kind==='weekly'?daysLong[Number(block.weekday)]:new Date(`${block.date}T12:00:00`).toLocaleDateString('pt-BR')}</strong><span>{block.startTime}–{block.endTime}{block.note?` · ${block.note}`:''}</span><Button className="availability-edit" aria-label={`Editar ${block.kind==='weekly'?daysLong[Number(block.weekday)]:'indisponibilidade'}`} onClick={()=>{setEditing(block);setAvailabilityKind(block.kind);}}>✎</Button></div><div className="availability-actions"><Button className="availability-remove" aria-label="Remover indisponibilidade" onClick={()=>setDeleting(block)}>🗑</Button></div><AvailabilityExceptions block={block} act={act}/></li>)}</ul>{!blocks.length&&<p className="privacy-note">Sem informações cadastradas — isso não será tratado como disponibilidade confirmada.</p>}</AgendaWorkflow>
    {deleting&&<Dialog title="Remover indisponibilidade" onClose={()=>setDeleting(undefined)}><p>Remover este horário altera as próximas consultas de disponibilidade.</p><div className="form-actions"><Button onClick={()=>setDeleting(undefined)}>Cancelar</Button><Button variant="danger" disabled={saving} onClick={()=>void act(()=>deleteAvailability(deleting.id),'Indisponibilidade removida.').then(saved=>{if(saved)setDeleting(undefined);})}>Confirmar remoção</Button></div></Dialog>}
    {selectedDay&&<Dialog title={`Compromissos · ${new Date(selectedDay+'T12:00:00').toLocaleDateString('pt-BR')}`} onClose={()=>setSelectedDay(undefined)}>{items.filter(item=>new Date(item.startsAt)<addDays(new Date(selectedDay+'T00:00:00'),1)&&new Date(item.endsAt)>new Date(selectedDay+'T00:00:00')).map(item=><CalendarEventCard key={`${item.type}-${item.id}`} day={new Date(selectedDay+'T00:00:00')} item={item} members={members} spaces={spaces} departments={departments} act={act} feedback={feedback} busy={saving}/>)}{!items.some(item=>new Date(item.startsAt)<addDays(new Date(selectedDay+'T00:00:00'),1)&&new Date(item.endsAt)>new Date(selectedDay+'T00:00:00'))&&<p>Nenhum compromisso neste dia.</p>}</Dialog>}
    {canManage&&<AgendaWorkflow protectChanges busy={saving} title="Criar reunião" open={meetingOpen} headerActions={meetingReturn.current&&<Button onClick={()=>{setMeetingOpen(false);const resume=meetingReturn.current;meetingReturn.current=undefined;resume?.();}}>← Voltar</Button>} onClose={()=>{if(!saving){setMeetingOpen(false);meetingReturn.current=undefined;}}}>{feedback&&<p role="alert">{feedback}</p>}<form key={meetingDraft} className="agenda-form" onSubmit={submitMeeting}><label className="wide-field">Título<input name="title" required maxLength={200}/></label><details className="optional-fields"><summary>Descrição e local (opcionais)</summary><div><label>Descrição<textarea name="description" maxLength={10000}/></label><label>Local<input name="location" maxLength={255}/></label></div></details><AgendaTimeFields startsAt={schedule?.start} endsAt={schedule?.end}/><AgendaAudience spaces={spaces} members={members} departments={departments} initialWorkspace={recommendedWorkspaceId} initialDepartment={recommendedDepartmentId} selectedIds={schedule?.ids}/><label className="wide-field inline-check"><input type="checkbox" checked={meetingReview} onChange={e=>setMeetingReview(e.target.checked)}/>Solicitar revisão de disponibilidade antes de criar</label>{meetingReview&&<p className="wide-field availability-hint">Ao confirmar, os convidados receberão um pedido de revisão para os sete dias a partir da data escolhida, com este título e contexto. A reunião ainda não será criada. Ajuste os campos antes de enviar.</p>}<div className="wide-field meeting-submit"><Button variant="primary" disabled={saving} aria-busy={saving}>{saving?'Enviando…':meetingReview?'Confirmar solicitação de revisão':'Criar reunião'}</Button></div></form></AgendaWorkflow>}
    <div hidden={tab!=='operations'}><AgendaOperations active={tab==='operations'} departments={departments} polls={polls} shifts={shifts} members={members} spaces={spaces} canManage={canManage} onSaved={load}/></div>

  </>;
}
