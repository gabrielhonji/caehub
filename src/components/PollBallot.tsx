import {useState,type FormEvent} from 'react';
import {votePoll,type MeetingPoll} from '../services/agenda-advanced';
import {AgendaTimeFields} from './AgendaTimeFields';
import {Button} from './primitives';
import {dateRange} from '../domain/date-format';
export function PollBallot({poll,onSubmit}:{poll:MeetingPoll;onSubmit:(event:FormEvent<HTMLFormElement>,work:(data:FormData)=>Promise<unknown>,success:string)=>void}){
 const [none,setNone]=useState(poll.noneWorks),[selected,setSelected]=useState(poll.options.filter(o=>o.selected).map(o=>o.id)),[alternative,setAlternative]=useState(Boolean(poll.suggestedStart&&poll.suggestedEnd));
 return <form className="agenda-form" onSubmit={event=>onSubmit(event,data=>votePoll(poll.id,none?[]:selected,none,none?{note:String(data.get('note')||''),...(alternative?{startsAt:new Date(String(data.get('alternativeStart'))).toISOString(),endsAt:new Date(String(data.get('alternativeEnd'))).toISOString()}:{})}:undefined),'Voto registrado.')}>
 <fieldset className="participant-picker" disabled={!poll.open||!poll.invited}><legend>Horários em que você pode comparecer</legend>{poll.options.map(o=><label key={o.id}><input type="checkbox" checked={!none&&selected.includes(o.id)} onChange={event=>{setNone(false);setSelected(ids=>event.target.checked?[...ids,o.id]:ids.filter(id=>id!==o.id));}}/><span>{dateRange(o.startsAt,o.endsAt)} · {o.votes} votos</span></label>)}<label><input type="checkbox" checked={none} onChange={e=>{setNone(e.target.checked);if(e.target.checked)setSelected([]);}}/><span>Nenhuma opção funciona</span></label></fieldset>
 {none&&<><label className="wide-field">Observação ou sugestão<textarea name="note" maxLength={1000} defaultValue={poll.suggestionNote} placeholder="Ex.: sexta-feira é melhor para mim" disabled={!poll.open||!poll.invited}/></label><label className="inline-check"><input type="checkbox" checked={alternative} onChange={e=>setAlternative(e.target.checked)}/>Sugerir um horário específico</label>{alternative&&<AgendaTimeFields startName="alternativeStart" endName="alternativeEnd" startsAt={poll.suggestedStart} endsAt={poll.suggestedEnd}/>}</>}
 {poll.open&&poll.invited&&<Button>{poll.votedAt?'Alterar voto':'Salvar voto'}</Button>}</form>;
}
