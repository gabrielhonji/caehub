import {useEffect,useRef,useState} from 'react';
import {useRefresh} from '../hooks/useRefresh';
import {getMeetings,type CalendarItem} from '../services/agenda';
import {dateRange} from '../domain/date-format';
import {Button,Eyebrow} from './primitives';

export function HomeAgenda(){
 const [items,setItems]=useState<CalendarItem[]>(),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 const generation=useRef(0);
 const load=async()=>{const current=++generation.current;setError(false);try{const rows=await getMeetings(false);if(current===generation.current)setItems(rows.filter(item=>new Date(item.endsAt)>=new Date()&&item.response!=='declined'&&Boolean(item.response||item.canManage)).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).slice(0,3));}catch{if(current===generation.current)setError(true);}};
 useRefresh(load,'meetings');
 useEffect(()=>{void load();return()=>{generation.current++;};},[retry]);
 return <section className="home-agenda"><header><div><Eyebrow>PRÓXIMOS COMPROMISSOS</Eyebrow><h2>Suas reuniões</h2></div><div className="home-agenda-actions"><a className="button button-secondary" href="#/agenda?tab=availability">Meus horários</a><a className="button button-primary" href="#/agenda?tab=meetings">Ver reuniões →</a></div></header>{error?<div role="alert">Não foi possível consultar as reuniões. <Button onClick={()=>setRetry(value=>value+1)}>Tentar novamente</Button></div>:!items?<p role="status">Consultando reuniões…</p>:items.length?<ul>{items.map(item=><li key={item.id}><div><strong>{item.title}</strong><time>{dateRange(item.startsAt,item.endsAt)}</time></div><a aria-label={`${item.response==='pending'?'Responder convite':'Ver reunião'}: ${item.title}`} className="button button-secondary" href={`#/agenda?kind=meeting&resource=${encodeURIComponent(item.id)}`}>{item.response==='pending'?'Responder convite':'Ver reunião'} →</a></li>)}</ul>:<div className="home-agenda-empty"><span aria-hidden="true">✓</span><p>Nenhuma reunião prevista.</p></div>}</section>;
}
