export const shortDate=(value:string)=>{const d=new Date(value);return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',...(d.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})});};
export const shortTime=(value:string)=>new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
export const dateRange=(start:string,end:string)=>`${shortDate(start)} · ${shortTime(start)}–${new Date(start).toDateString()===new Date(end).toDateString()?'':shortDate(end)+' · '}${shortTime(end)}`;
