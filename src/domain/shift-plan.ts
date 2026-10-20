export function shiftPlan(input:{date:string;start:string;minutes:number;count:number;breakStart?:string;breakEnd?:string}){
 const base=Date.parse(`${input.date}T${input.start}`),breakStart=input.breakStart?Date.parse(`${input.date}T${input.breakStart}`):0,breakEnd=input.breakEnd?Date.parse(`${input.date}T${input.breakEnd}`):0;
 if(!Number.isFinite(base)||!Number.isInteger(input.minutes)||input.minutes<30||input.minutes>1440||!Number.isInteger(input.count)||input.count<1||input.count>30)throw Error('Confira data, início, duração e quantidade de turnos.');
 if(Boolean(input.breakStart)!==Boolean(input.breakEnd)||(breakStart&&breakEnd<=breakStart))throw Error('Informe um intervalo com início e fim válidos.');
 let cursor=base;return Array.from({length:input.count},()=>{if(breakStart&&cursor<breakEnd&&cursor+input.minutes*60000>breakStart)cursor=breakEnd;const start=cursor;cursor+=input.minutes*60000;return {startsAt:new Date(start).toISOString(),endsAt:new Date(cursor).toISOString()};});
}

export function weeklyShiftPlan(input:{from:string;to:string;weekdays:number[];start:string;end:string;excluded:string[]}){
 const from=new Date(`${input.from}T12:00:00`),to=new Date(`${input.to}T12:00:00`);
 if(!Number.isFinite(+from)||!Number.isFinite(+to)||to<from||(+to-+from)>92*86400000)throw Error('Escolha um período de até três meses.');
 if(!input.weekdays.length||!input.start||!input.end||input.end<=input.start)throw Error('Selecione os dias e um horário de término posterior ao início.');
 const rows:{startsAt:string;endsAt:string}[]=[];
 for(const date=new Date(from);date<=to;date.setDate(date.getDate()+1)){
   const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
   if(input.weekdays.includes(date.getDay())&&!input.excluded.includes(key))rows.push({startsAt:new Date(`${key}T${input.start}`).toISOString(),endsAt:new Date(`${key}T${input.end}`).toISOString()});
 }
 if(!rows.length||rows.length>30)throw Error('A escala precisa conter entre 1 e 30 turnos. Reduza o período ou ajuste os dias.');
 return rows;
}
