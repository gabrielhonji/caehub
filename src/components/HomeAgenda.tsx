import {useEffect,useState} from 'react';
import {getMeetings,type CalendarItem} from '../services/agenda';
import {dateRange} from '../domain/date-format';
import {Button,Eyebrow} from './primitives';

export function HomeAgenda(){
 const [items,setItems]=useState<CalendarItem[]>(),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setError(false);getMeetings(false).then(rows=>{if(active)setItems(rows.filter(item=>new Date(item.endsAt)>=new Date()&&item.response!=='declined'&&Boolean(item.response||item.canManage)).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,3));}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[retry]);
 return <section className="home-agenda"><div><Eyebrow>PRÓXIMOS COMPROMISSOS</Eyebrow><h2>Suas reuniões</h2></div>{error?<div role="alert">Não foi possível consultar as reuniões. <Button onClick={()=>setRetry(value=>value+1)}>Tentar novamente</Button></div>:!items?<p role="status">Consultando reuniões…</p>:items.length?<ul>{items.map(item=><li key={item.id}><a href={`#/agenda?kind=meeting&resource=${encodeURIComponent(item.id)}`}><strong>{item.title}</strong><time>{dateRange(item.startsAt,item.endsAt)}</time>{item.response==='pending'&&<span>Responder convite →</span>}</a></li>)}</ul>:<p>Nenhuma reunião sua prevista. <a href="#/agenda?tab=availability">Mantenha seus horários atualizados →</a></p>}<a href="#/agenda?tab=meetings">Ver reuniões →</a></section>;
}
