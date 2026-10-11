export const isTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
export const minutes = (value: string) => Number(value.slice(0,2))*60+Number(value.slice(3));
export const clock = (value: number) => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
export const presetTimes = Array.from({length:48},(_,index)=>clock(index*30));
export const nextTime = (value: string) => isTime(value)&&minutes(value)<1439?clock(Math.min(1439,minutes(value)+30)):'';
export const today = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function timetableIssues(input:{term:string;validFrom:string;validTo:string;reviewed:boolean;rows:{weekday:number;startTime:string|null;endTime:string|null}[]}) {
  const issues:string[]=[];
  if(!input.term.trim())issues.push('Informe o período letivo.');
  if(!input.validFrom)issues.push('Informe o primeiro dia do período.');
  if(!input.validTo)issues.push('Informe o último dia do período.');
  if(input.validFrom&&input.validTo&&input.validTo<input.validFrom)issues.push('O último dia precisa ser igual ou posterior ao primeiro.');
  if(!input.rows.length)issues.push('Adicione pelo menos um bloco de horários.');
  input.rows.forEach((row,index)=>{
    if(!Number.isInteger(row.weekday)||row.weekday<0||row.weekday>6)issues.push(`Bloco ${index+1}: selecione um dia válido.`);
    if(!isTime(row.startTime??''))issues.push(`Bloco ${index+1}: preencha o horário inicial.`);
    if(!isTime(row.endTime??''))issues.push(`Bloco ${index+1}: preencha o horário final.`);
    if(isTime(row.startTime??'')&&isTime(row.endTime??'')&&row.endTime!<=row.startTime!)issues.push(`Bloco ${index+1}: o fim precisa ser posterior ao início.`);
  });
  if(!input.reviewed)issues.push('Confirme que conferiu os dias e horários.');
  return issues;
}
