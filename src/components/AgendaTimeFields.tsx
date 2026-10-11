import {useEffect,useId,useRef,useState} from 'react';
import {clock,isTime,minutes,nextTime,presetTimes,today} from '../domain/agenda-input';

const localParts=(value?:string)=>{if(!value)return {date:today(),time:''};const d=new Date(value);return {date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,time:`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};};

/** One date and bounded clock inputs, translated into the existing API timestamps. */
export function AgendaTimeFields({startName='startsAt',endName='endsAt',startsAt,endsAt,withDate=true,startDefault='',endDefault=''}:{startName?:string;endName?:string;startsAt?:string;endsAt?:string;withDate?:boolean;startDefault?:string;endDefault?:string}) {
  const initialStart=localParts(startsAt),initialEnd=localParts(endsAt);
  const defaults={date:initialStart.date,endDate:endsAt?initialEnd.date:initialStart.date,start:startsAt?initialStart.time:startDefault,end:endsAt?initialEnd.time:endDefault};
  const [date,setDate]=useState(defaults.date),[endDate,setEndDate]=useState(defaults.endDate),[start,setStart]=useState(defaults.start),[end,setEnd]=useState(defaults.end);
  const [multipleDays,setMultipleDays]=useState(Boolean(endsAt&&initialEnd.date!==initialStart.date));
  const [custom,setCustom]=useState(Boolean((defaults.start&&!presetTimes.includes(defaults.start))||(defaults.end&&!presetTimes.includes(defaults.end))));
  const [error,setError]=useState('');const wrapper=useRef<HTMLDivElement>(null),id=useId();
  useEffect(()=>{const form=wrapper.current?.closest('form');const reset=()=>{setDate(defaults.date);setEndDate(defaults.endDate);setStart(defaults.start);setEnd(defaults.end);setMultipleDays(Boolean(endsAt&&initialEnd.date!==initialStart.date));setCustom(Boolean((defaults.start&&!presetTimes.includes(defaults.start))||(defaults.end&&!presetTimes.includes(defaults.end))));setError('');};form?.addEventListener('reset',reset);return()=>form?.removeEventListener('reset',reset);},[startsAt,endsAt,startDefault,endDefault]);
  const sameDay=!withDate||!multipleDays||endDate===date;
  const valid=isTime(start)&&isTime(end)&&(!sameDay||end>start)&&(!withDate||Boolean(date&&(!multipleDays||endDate>=date)));
  const changeStart=(value:string)=>{setStart(value);setError('');if(sameDay&&end&&value>=end)setEnd(nextTime(value));};
  const changeEnd=(value:string)=>{if(value&&sameDay&&value<=start){setError('Escolha um horário final posterior ao inicial.');return;}setEnd(value);setError('');};
  const endChoices=[...presetTimes,'23:59'].filter(t=>!sameDay||t>start);
  if(end&&(!sameDay||end>start)&&!endChoices.includes(end))endChoices.push(end);
  return <div ref={wrapper} className="agenda-time-fields wide-field">
    <div className="agenda-time-grid">
      {withDate&&<label>Data<input type="date" required value={date} onChange={e=>{setDate(e.target.value);if(!multipleDays||endDate<e.target.value){setEndDate(e.target.value);if(end<=start)setEnd(nextTime(start));}}}/></label>}
      <label>Horário de início{custom?<input type="time" aria-label="Horário de início" required value={start} max={sameDay?'23:58':undefined} onChange={e=>changeStart(e.target.value)}/>:<select aria-label="Horário de início" required value={start} onChange={e=>changeStart(e.target.value)}><option value="" disabled>Escolha o início</option>{presetTimes.map(t=><option key={t}>{t}</option>)}</select>}</label>
      <label>Horário de término{custom?<input type="time" aria-label="Horário de término" required value={end} disabled={!start} min={sameDay&&isTime(start)?clock(Math.min(1439,minutes(start)+1)):undefined} aria-describedby={error?id:undefined} onChange={e=>changeEnd(e.target.value)}/>:<select aria-label="Horário de término" required value={end} disabled={!start} onChange={e=>changeEnd(e.target.value)}><option value="" disabled>Escolha o término</option>{endChoices.map(t=><option key={t}>{t}</option>)}</select>}</label>
      {withDate&&multipleDays&&<label>Data de término<input type="date" required min={date} value={endDate} onChange={e=>{if(e.target.value<date)return;setEndDate(e.target.value);if(e.target.value===date&&end<=start)setEnd(nextTime(start));}}/></label>}
    </div>
    <div className="agenda-time-options"><label className="inline-check"><input type="checkbox" checked={custom} onChange={e=>{setCustom(e.target.checked);if(!e.target.checked){if(start&&!presetTimes.includes(start))setStart('');if(end&&!presetTimes.includes(end))setEnd('');}}}/><span>Usar horários específicos</span></label>{withDate&&<label className="inline-check"><input type="checkbox" checked={multipleDays} onChange={e=>{setMultipleDays(e.target.checked);if(!e.target.checked&&end<=start)setEnd(nextTime(start));}}/><span>Termina em outro dia</span></label>}</div>
    {error&&<p id={id} className="field-error" role="alert">{error}</p>}
    <input type="hidden" name={startName} value={valid?(withDate?`${date}T${start}`:start):''}/><input type="hidden" name={endName} value={valid?(withDate?`${multipleDays?endDate:date}T${end}`:end):''}/>
  </div>;
}
