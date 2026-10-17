export function shiftPlan(input:{date:string;start:string;minutes:number;count:number;breakStart?:string;breakEnd?:string}){
 const base=Date.parse(`${input.date}T${input.start}`),breakStart=input.breakStart?Date.parse(`${input.date}T${input.breakStart}`):0,breakEnd=input.breakEnd?Date.parse(`${input.date}T${input.breakEnd}`):0;
 if(!Number.isFinite(base)||!Number.isInteger(input.minutes)||input.minutes<30||input.minutes>1440||!Number.isInteger(input.count)||input.count<1||input.count>30)throw Error('Confira data, início, duração e quantidade de turnos.');
 if(Boolean(input.breakStart)!==Boolean(input.breakEnd)||(breakStart&&breakEnd<=breakStart))throw Error('Informe um intervalo com início e fim válidos.');
 let cursor=base;return Array.from({length:input.count},()=>{if(breakStart&&cursor<breakEnd&&cursor+input.minutes*60000>breakStart)cursor=breakEnd;const start=cursor;cursor+=input.minutes*60000;return {startsAt:new Date(start).toISOString(),endsAt:new Date(cursor).toISOString()};});
}
