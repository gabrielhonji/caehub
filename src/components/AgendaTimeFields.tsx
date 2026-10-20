import {DateInput} from './DateInput';
import {useEffect,useRef,useState,useId} from 'react';
import {clock,isTime,minutes,presetTimes,today} from '../domain/agenda-input';
const parts=(value?:string)=>{if(!value)return {date:today(),time:''};const d=new Date(value);return {date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};};
const nextDate=(date:string,days:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);return parts(d.toISOString()).date;};
export function AgendaTimeFields({startName='startsAt',endName='endsAt',startsAt,endsAt,withDate=true,startDefault='',endDefault='',durationDefault=60}:{startName?:string;endName?:string;startsAt?:string;endsAt?:string;withDate?:boolean;startDefault?:string;endDefault?:string;durationDefault?:number}){
 const a=parts(startsAt),b=parts(endsAt),initialStart=startsAt?a.time:startDefault,initialEnd=endsAt?b.time:endDefault,initialOther=Boolean(endsAt&&a.date!==b.date);
 const initialDuration=startsAt&&endsAt?Math.round((Date.parse(endsAt)-Date.parse(startsAt))/60000):initialStart&&initialEnd?minutes(initialEnd)-minutes(initialStart):durationDefault;
 const preset=(n:number)=>[60,90,120,180,240].includes(n)?String(n):'custom';
 const [date,setDate]=useState(a.date),[endDate,setEndDate]=useState(endsAt?b.date:a.date),[start,setStart]=useState(initialStart),[end,setEnd]=useState(initialEnd),[duration,setDuration]=useState(initialOther?'custom':preset(initialDuration)),[otherDay,setOtherDay]=useState(initialOther);
 const wrapper=useRef<HTMLDivElement>(null),startInput=useRef<HTMLInputElement>(null),listId=useId();
 useEffect(()=>{if(duration==='custom'||!isTime(start)||(withDate&&!date))return;const total=minutes(start)+Number(duration);if(!withDate&&total>=1440){setEnd('');return;}setEnd(clock(total%1440));setEndDate(nextDate(date,Math.floor(total/1440)));},[date,start,duration,withDate]);
 useEffect(()=>{const form=wrapper.current?.closest('form');const reset=()=>{setDate(a.date);setStart(initialStart);setEnd(initialEnd);setEndDate(endsAt?b.date:a.date);setDuration(initialOther?'custom':preset(initialDuration));setOtherDay(initialOther);};form?.addEventListener('reset',reset);return()=>form?.removeEventListener('reset',reset);},[startsAt,endsAt,startDefault,endDefault]);
 const actualEndDate=duration==='custom'?(otherDay?endDate:date):endDate;
 const valid=isTime(start)&&isTime(end)&&(withDate?Boolean(date)&&Boolean(actualEndDate)&&new Date(`${actualEndDate}T${end}`)>new Date(`${date}T${start}`):end>start);
 useEffect(()=>{startInput.current?.setCustomValidity(start&&!valid?'O término precisa ser posterior ao início.':'');},[start,valid]);
 return <div ref={wrapper} className="agenda-time-fields wide-field"><div className="agenda-time-grid">
 {withDate&&<label>Data<DateInput required value={date} onChange={e=>setDate(e.target.value)}/></label>}
 <label>Início<input ref={startInput} type="time" step={60} required value={start} onChange={e=>setStart(e.target.value)} list={listId}/></label><datalist id={listId}>{presetTimes.map(t=><option key={t} value={t}/>)}</datalist>
 {!otherDay&&<label>Duração<select aria-label="Duração" value={duration} onChange={e=>setDuration(e.target.value)}>{[60,90,120,180,240].map(m=><option key={m} value={m}>{m===90?'1h30':`${m/60} ${m===60?'hora':'horas'}`}</option>)}<option value="custom">Término específico</option></select></label>}
 {duration==='custom'?<>{otherDay&&<label>Data de término<DateInput min={date} value={endDate} required onChange={e=>setEndDate(e.target.value)}/></label>}<label>Término<input type="time" step={60} required value={end} onChange={e=>setEnd(e.target.value)}/></label></>:<p className="time-end-preview"><small>Término</small><strong>{end||'—'}{actualEndDate>date?` · ${new Date(`${actualEndDate}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit'})}`:''}</strong><span>Calculado pela duração</span></p>}
 </div>{withDate&&<label className="inline-check time-other-day"><input type="checkbox" checked={otherDay} onChange={e=>{setOtherDay(e.target.checked);setDuration('custom');if(e.target.checked&&endDate<=date)setEndDate(nextDate(date,1));}}/>Termina em outro dia</label>}
 {start&&!valid&&end&&<p className="field-error" role="alert">O término precisa ser posterior ao início.{!withDate?' Para atravessar a meia-noite, divida a disponibilidade em dois blocos.':''}</p>}
 <input type="hidden" name={startName} value={valid?(withDate?`${date}T${start}`:start):''}/><input type="hidden" name={endName} value={valid?(withDate?`${actualEndDate}T${end}`:end):''}/></div>;
}
