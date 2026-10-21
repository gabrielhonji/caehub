import {PollTimeOptions} from './PollTimeOptions';
import {DeadlineField} from './DeadlineField';
import {ShiftBatch} from './ShiftBatch';
import {OpinionPolls} from './OpinionPolls';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Space } from '../domain/types';
import type { MemberOption,DepartmentOption } from '../services/agenda';
import { cancelShift, closePoll, createPoll, createShift, participateShift, relatedShiftMeetings, shiftHistory, updateShift, votePoll, type MeetingPoll, type OperationalShift } from '../services/agenda-advanced';
import { AgendaAudience } from './AgendaAudience';
import { PollBallot } from './PollBallot';
import { dateRange,shortDate } from '../domain/date-format';
import { AgendaPeoplePicker } from './AgendaPeoplePicker';
import { AgendaTimeFields } from './AgendaTimeFields';
import { AgendaWorkflow } from './AgendaWorkflow';
import { Badge, Button, Toast, Dialog, EmptyState, Eyebrow } from './primitives';

const dateTime=(value:string)=>`${shortDate(value)} · ${new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`;
const instant=(value:FormDataEntryValue|null)=>new Date(String(value)).toISOString();
const statusLabel:Record<string,string>={pending:'Reserva pendente',confirmed:'Confirmado',declined:'Recusado',withdrawn:'Desistiu',removed:'Removido',cancelled:'Cancelado'};
const actionLabel:Record<string,string>={created:'Turno criado',assign:'Vaga atribuída',volunteer:'Inscrição voluntária',accept:'Reserva aceita',decline:'Reserva recusada',withdraw:'Desistência',remove:'Participação removida',updated:'Turno atualizado',cancelled:'Turno cancelado'};
type Run=(work:()=>Promise<unknown>,message:string)=>Promise<boolean>;

function ShiftFields({spaces,shift}:{spaces:Space[];shift?:OperationalShift}) {
  const [workspaceId,setWorkspaceId]=useState(shift?.workspaceId??''),[meetings,setMeetings]=useState<Awaited<ReturnType<typeof relatedShiftMeetings>>>([]),[error,setError]=useState('');
  useEffect(()=>{let active=true;setMeetings([]);setError('');if(workspaceId)void relatedShiftMeetings(workspaceId).then(rows=>{if(active)setMeetings(rows);}).catch(()=>{if(active)setError('Não foi possível carregar reuniões deste espaço.');});return ()=>{active=false;};},[workspaceId]);
  return <>
    <label>Título<input name="title" required maxLength={200} defaultValue={shift?.title}/></label>
    <AgendaTimeFields startsAt={shift?.startsAt} endsAt={shift?.endsAt}/>
    <label>Espaço responsável<select name="workspaceId" required value={workspaceId} onChange={event=>setWorkspaceId(event.target.value)}><option value="" disabled>Selecione</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <label>Capacidade máxima<input name="maximumCapacity" type="number" min={1} max={1000} required defaultValue={shift?.maximumCapacity??1}/></label>
    <details className="optional-fields"><summary>Detalhes e configurações do turno (opcionais)</summary><div><label>Descrição (opcional)<textarea name="description" maxLength={10000} defaultValue={shift?.description}/></label><label>Local (opcional)<input name="location" maxLength={255} defaultValue={shift?.location}/></label><label>Reunião/evento relacionado (opcional)<select key={`${workspaceId}-${meetings.length}`} name="relatedMeetingId" defaultValue={workspaceId===shift?.workspaceId?shift?.relatedMeetingId??'':''}><option value="">Sem associação</option>{workspaceId===shift?.workspaceId&&shift?.relatedMeetingId&&!meetings.some(m=>m.id===shift.relatedMeetingId)&&<option value={shift.relatedMeetingId}>Reunião vinculada</option>}{meetings.map(m=><option key={m.id} value={m.id}>{m.title} · {dateTime(m.startsAt)}</option>)}</select></label>{error&&<p role="alert">{error}</p>}
    <label>Equipe mínima (opcional)<input name="minimumCapacity" type="number" min={0} max={1000} defaultValue={shift?.minimumCapacity??''}/></label>
    <label>Aviso prioritário de desistência (horas antes)<input name="priorityWindowHours" type="number" min={0} max={8760} required defaultValue={shift?.priorityWindowHours??2}/></label>
    <p>O padrão é 2 horas. Reservas também ocupam vagas; apenas confirmações contam para a equipe mínima.</p></div></details>
  </>;
}
function shiftData(data:FormData) {
  return {title:String(data.get('title')),description:String(data.get('description')||''),location:String(data.get('location')||''),workspaceId:String(data.get('workspaceId')),relatedMeetingId:String(data.get('relatedMeetingId')||'')||null,startsAt:instant(data.get('startsAt')),endsAt:instant(data.get('endsAt')),minimumCapacity:data.get('minimumCapacity')===''?null:Number(data.get('minimumCapacity')),maximumCapacity:Number(data.get('maximumCapacity')),priorityWindowHours:Number(data.get('priorityWindowHours'))};
}

export function AgendaOperations({polls,shifts,members,spaces,departments,canManage,onSaved,active=true}:{polls:MeetingPoll[];shifts:OperationalShift[];members:MemberOption[];departments:DepartmentOption[];spaces:Space[];canManage:boolean;onSaved:()=>Promise<void>;active?:boolean}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[notice,setNotice]=useState('');
  const [opinionRequest,setOpinionRequest]=useState(0);
  const [view,setView]=useState<'opinions'|'polls'|'shifts'>('opinions'),[archived,setArchived]=useState(false);
  const [task,setTask]=useState<'newPoll'|'newShift'|'poll'|'shift'|null>(null);
  const [selectedId,setSelectedId]=useState('');
  useEffect(()=>{const check=()=>{const q=new URLSearchParams(location.hash.split('?')[1]),kind=q.get('kind'),resource=q.get('resource');if(kind==='opinion')setView('opinions');if(resource&&(kind==='poll'||kind==='shift')){setSelectedId(resource);setView(kind==='poll'?'polls':'shifts');setTask(kind==='poll'?'poll':'shift');}};check();window.addEventListener('hashchange',check);return()=>window.removeEventListener('hashchange',check);},[]);
  const visiblePolls=polls.filter(p=>archived||!p.closedAt);
  const visibleShifts=shifts.filter(s=>archived||(!s.cancelledAt&&new Date(s.endsAt)>=new Date()));
  const [confirmation,setConfirmation]=useState<{title:string;text:string;work:()=>Promise<unknown>} | null>(null);
  const [history,setHistory]=useState<Awaited<ReturnType<typeof shiftHistory>>>();
  const opener=useRef<HTMLElement|null>(null);
  const rememberFocus=()=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;};
  const openConfirmation=(value:NonNullable<typeof confirmation>)=>{rememberFocus();setConfirmation(value);};
  const run:Run=async(work,success)=>{if(busy)return false;if(!confirmation&&!history)rememberFocus();setBusy(true);setMessage('');setNotice('');try {await work();await onSaved();setNotice(success);return true;}catch(error){setMessage(error instanceof Error?error.message:'Não foi possível salvar.');return false;}finally{setBusy(false);}};
  const participate=(shift:OperationalShift,action:string,membershipId?:string)=>void run(async()=>{
    try {await participateShift(shift.id,{action,membershipId});}
    catch(error) {
      if((error as {code?:string}).code!=='schedule_conflict')throw error;
      setConfirmation({title:'Conflito de horário',text:'Há sobreposição com aulas, reuniões ou outros turnos. Ao prosseguir, sua decisão será registrada. A reserva atribuída ainda exige aceite.',work:()=>participateShift(shift.id,{action,membershipId,confirmConflict:true})});throw error;
    }
  },'Operação processada.');
  const submit=(event:FormEvent<HTMLFormElement>,work:(data:FormData)=>Promise<unknown>,success:string)=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form);void run(()=>work(data),success).then(saved=>{if(saved&&(task==='newPoll'||task==='newShift')){setTask(null);form.reset();}});};
  return <section className="advanced-agenda agenda-operations" aria-busy={busy}><Toast message={notice}/>
    <div className="agenda-section-heading"><div><Eyebrow>CONVITES E PARTICIPAÇÕES</Eyebrow><h2>Votações e turnos</h2><p>Consulte o que precisa da sua resposta e abra um item para participar ou gerenciar.</p></div></div>
    <fieldset disabled={busy} className="workflow-controls agenda-operations-toolbar"><div role="group" aria-label="Tipo de participação"><Button aria-pressed={view==='opinions'} onClick={()=>setView('opinions')}>Votações livres</Button><Button aria-pressed={view==='polls'} onClick={()=>setView('polls')}>Horários ({polls.filter(p=>!p.closedAt).length})</Button><Button aria-pressed={view==='shifts'} onClick={()=>setView('shifts')}>Turnos ({shifts.filter(s=>!s.cancelledAt&&new Date(s.endsAt)>=new Date()).length})</Button></div>{canManage&&view==='opinions'&&<Button variant="primary" onClick={()=>setOpinionRequest(n=>n+1)}>Criar votação livre</Button>}{canManage&&view==='shifts'&&<ShiftBatch spaces={spaces} onSaved={onSaved}/>} {canManage&&view!=='opinions'&&<Button variant={view==='polls'?'primary':'secondary'} onClick={()=>setTask(view==='polls'?'newPoll':'newShift')}>{view==='polls'?'Criar votação de horários':'Criar turno único'}</Button>}<div className="agenda-filter-group" role="group" aria-label="Status das participações"><Button aria-pressed={!archived} onClick={()=>setArchived(false)}>Ativos</Button><Button aria-pressed={archived} onClick={()=>setArchived(true)}>Incluir encerrados e cancelados</Button></div></fieldset>

    {view==='opinions'&&<OpinionPolls active={active} departments={departments} creationRequest={opinionRequest} spaces={spaces} members={members} canManage={canManage} archived={archived}/>}
    {!task&&message&&<p role="alert">{message}</p>}
    <fieldset disabled={busy} className="workflow-controls">
      {canManage&&<AgendaWorkflow protectChanges busy={busy} title="Criar votação de horários" open={task==='newPoll'} onClose={()=>setTask(null)}><p role="status">{message}</p><form className="agenda-form" onSubmit={event=>submit(event,data=>createPoll({title:String(data.get('title')),description:String(data.get('description')||''),location:String(data.get('location')||''),workspaceId:String(data.get('workspaceId')||'')||undefined,deadline:data.get('deadline')?instant(data.get('deadline')):undefined,participantIds:data.getAll('participantIds').map(String),options:data.getAll('start-option').map((start,index)=>({startsAt:instant(start),endsAt:instant(data.getAll('end-option')[index])}))}),'Votação criada; participantes notificados.')}>
        <label className="wide-field">Título<input name="title" required maxLength={200}/></label><details className="optional-fields"><summary>Descrição, local e prazo (opcionais)</summary><div><label>Descrição (opcional)<textarea name="description" maxLength={10000}/></label><label>Local (opcional)<input name="location" maxLength={255}/></label><DeadlineField active={task==='newPoll'} eventField="start-*"/></div></details>
        <AgendaAudience spaces={spaces} members={members} departments={departments}/>
        <PollTimeOptions/>
        <Button variant="primary">Abrir votação</Button>
      </form></AgendaWorkflow>}
      {view==='polls'&&!visiblePolls.length&&<EmptyState title="Nenhuma votação">As votações dirigidas a você aparecerão aqui.</EmptyState>}
      {polls.map(poll=>{
        const max=Math.max(...poll.options.map(o=>Number(o.votes))),leaders=poll.options.filter(o=>Number(o.votes)===max);
        return <div key={poll.id}>
          {view==='polls'&&visiblePolls.some(p=>p.id===poll.id)&&<article className="agenda-list-row"><div><h3>{poll.title}</h3><p>{poll.deadline?`Prazo: ${dateTime(poll.deadline)}`:'Sem prazo definido'}</p><Badge tone={poll.closedAt?'neutral':poll.votedAt?'active':'waiting'}>{poll.closedAt?'Convocada':poll.votedAt?'Voto registrado':poll.invited?'Aguardando seu voto':'Acompanhando respostas'}</Badge></div><Button onClick={()=>{setSelectedId(poll.id);setTask('poll');}}>Abrir votação</Button></article>}
          <AgendaWorkflow busy={busy} title={poll.title} open={task==='poll'&&selectedId===poll.id} onClose={()=>setTask(null)}><p role="status">{message}</p><article className="workflow-card"><Badge tone={poll.closedAt?'neutral':poll.open?'active':'waiting'}>{poll.closedAt?'Reunião convocada':poll.open?'Votação aberta':'Prazo encerrado'}</Badge>{poll.description&&<p>{poll.description}</p>}{poll.deadline&&<p>Prazo: {dateTime(poll.deadline)}</p>}
          <PollBallot key={poll.votedAt??'not-voted'} poll={poll} onSubmit={submit}/>
          {poll.canManage&&poll.participants&&<p>{poll.participants.filter(p=>p.votedAt).length} de {poll.participants.length} participantes responderam. {poll.participants.filter(p=>p.noneWorks).length} sem horário adequado.</p>}
          {poll.canManage&&poll.participants&&<ul>{poll.participants.filter(p=>p.noneWorks).map(p=><li key={p.membershipId}><strong>{p.displayName}</strong>{p.suggestionNote&&<p>{p.suggestionNote}</p>}{p.suggestedStart&&p.suggestedEnd&&<p>{dateRange(p.suggestedStart,p.suggestedEnd)}</p>}</li>)}</ul>}
          {poll.canManage&&!poll.closedAt&&<form className="agenda-form" onSubmit={event=>submit(event,data=>closePoll(poll.id,String(data.get('winner')||'')||undefined),'Reunião convocada; votos vencedores confirmados.')}>
            {leaders.length>1&&max>0&&<label>Desempate<select name="winner" required defaultValue=""><option value="" disabled>Escolha entre os horários empatados</option>{leaders.map(o=><option key={o.id} value={o.id}>{dateTime(o.startsAt)}</option>)}</select></label>}
            {!max&&<p>Sem votos válidos: não é possível convocar.</p>}
            <label className="checkbox-label inline-check"><input type="checkbox" required/>Confirmo o encerramento e a convocação no horário vencedor.</label><Button disabled={!max}>Encerrar e convocar</Button>
          </form>}
        </article></AgendaWorkflow></div>;
      })}
      {canManage&&<AgendaWorkflow busy={busy} title="Criar turno" open={task==='newShift'} onClose={()=>setTask(null)}><p role="status">{message}</p><form className="agenda-form" onSubmit={event=>submit(event,data=>createShift(shiftData(data)),'Turno criado.')}><ShiftFields spaces={spaces}/><Button variant="primary">Criar turno</Button></form></AgendaWorkflow>}
      {view==='shifts'&&!visibleShifts.length&&<EmptyState title="Nenhum turno">Turnos dos seus espaços e reservas aparecerão aqui.</EmptyState>}
      {shifts.map(shift=><div key={shift.id}>
        {view==='shifts'&&visibleShifts.some(s=>s.id===shift.id)&&<article className="agenda-list-row"><div><h3>{shift.title}</h3><p>{shift.workspace} · {dateTime(shift.startsAt)}</p><Badge tone={shift.cancelledAt?'neutral':shift.ownStatus==='pending'?'waiting':shift.ownStatus==='confirmed'?'active':'neutral'}>{shift.cancelledAt?'Cancelado':shift.ownStatus==='pending'?'Sua reserva está pendente':shift.ownStatus==='confirmed'?'Você está confirmado':`${shift.remaining} vagas disponíveis`}</Badge></div><Button onClick={()=>{setSelectedId(shift.id);setTask('shift');}}>Ver turno</Button></article>}
        <AgendaWorkflow busy={busy} title={shift.title} open={task==='shift'&&selectedId===shift.id} onClose={()=>setTask(null)}><p role="status">{message}</p><article className="workflow-card" key={shift.revision}><p>{shift.workspace} · {dateRange(shift.startsAt,shift.endsAt)}</p>{shift.location&&<p>{shift.location}</p>}{shift.description&&<p>{shift.description}</p>}
        <Badge tone={shift.cancelledAt?'neutral':shift.minimumReached?'active':'waiting'}>{shift.cancelledAt?'Cancelado':`${shift.confirmed} confirmados · ${shift.reserved} reservas · ${shift.remaining} vagas`}</Badge>
        {!shift.cancelledAt&&<p>{shift.minimumCapacity==null?'Sem equipe mínima definida':`Equipe mínima: ${shift.minimumCapacity}${shift.minimumReached?' · Atingida':' · Ainda incompleta'}`}</p>}
        {shift.ownStatus&&<p>Sua participação: <strong>{statusLabel[shift.ownStatus]}</strong></p>}
        {!shift.cancelledAt&&<div className="response-actions">
          {shift.ownStatus==='pending'&&<><Button onClick={()=>participate(shift,'accept')}>Aceitar reserva</Button><Button onClick={()=>participate(shift,'decline')}>Recusar reserva</Button></>}
          {shift.ownStatus==='confirmed'&&<Button onClick={()=>openConfirmation({title:'Desistir do turno',text:'Sua vaga será liberada e o responsável será notificado.',work:()=>participateShift(shift.id,{action:'withdraw'})})}>Desistir</Button>}
          {shift.canVolunteer&&!['confirmed','pending'].includes(shift.ownStatus??'')&&<Button disabled={shift.remaining<=0} onClick={()=>participate(shift,'volunteer')}>Inscrever-me</Button>}
        </div>}
        <ul className="shift-participants">{shift.participants.map(p=><li key={p.membershipId}><span>{p.displayName} · {statusLabel[p.status]}</span>{shift.canManage&&!shift.cancelledAt&&['pending','confirmed'].includes(p.status)&&<Button onClick={()=>openConfirmation({title:'Remover participação',text:'A vaga será liberada e a pessoa será notificada.',work:()=>participateShift(shift.id,{action:'remove',membershipId:p.membershipId})})}>Remover</Button>}</li>)}</ul>
        {shift.canManage&&!shift.cancelledAt&&<details><summary>Gerenciar turno</summary>
          <form className="agenda-form" onSubmit={event=>{event.preventDefault();participate(shift,'assign',String(new FormData(event.currentTarget).get('membershipId')));}}><label>Atribuir reserva<select name="membershipId" required defaultValue=""><option value="" disabled>Selecione uma pessoa</option>{members.map(m=><option key={m.id} value={m.id}>{m.displayName}</option>)}</select></label><Button>Reservar vaga</Button></form>
          <form className="agenda-form" onSubmit={event=>submit(event,data=>updateShift(shift.id,{...shiftData(data),expectedRevision:shift.revision}),'Turno atualizado. Mudanças de horário exigem novo aceite.')}><ShiftFields spaces={spaces} shift={shift}/><Button>Salvar turno</Button></form>
          <Button onClick={()=>openConfirmation({title:'Cancelar turno',text:'Todas as participações serão canceladas e os horários liberados. O histórico será preservado.',work:()=>cancelShift(shift.id)})}>Cancelar turno</Button>
        </details>}
        {shift.canManage&&<Button onClick={()=>{rememberFocus();void shiftHistory(shift.id).then(setHistory).catch(error=>setMessage(error instanceof Error?error.message:'Não foi possível carregar o histórico.'));}}>Ver histórico</Button>}
      </article></AgendaWorkflow></div>)}
    </fieldset>
    {confirmation&&<Dialog title={confirmation.title} returnFocus={opener.current} onClose={()=>setConfirmation(null)}><p>{confirmation.text}</p><Button disabled={busy} variant="primary" onClick={()=>void run(confirmation.work,'Operação confirmada.').then(saved=>{if(saved)setConfirmation(null);})}>Confirmar e prosseguir</Button></Dialog>}
    {history&&<Dialog title="Histórico do turno" returnFocus={opener.current} onClose={()=>setHistory(undefined)}><ol className="shift-history">{history.map(h=><li key={h.id}><strong>{actionLabel[h.action]??h.action}</strong><p>{h.actor} · {dateTime(h.createdAt)}</p>{typeof h.data.status==='string'&&<p>{typeof h.data.previousStatus==='string'?`${statusLabel[h.data.previousStatus]} → `:''}{statusLabel[h.data.status]}</p>}{h.data.rescheduled===true&&<p>Horário alterado; participações voltaram a pendente.</p>}{h.data.conflictConfirmed===true&&<p>Conflito aceito conscientemente.</p>}</li>)}</ol></Dialog>}
  </section>;
}
