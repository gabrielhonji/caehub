import {useEffect,useRef,useState} from 'react';
import {localDeadline,suggestedDeadline} from '../domain/deadline';

/** Reads event dates from the surrounding form without changing its submission contract. */
export function DeadlineField({eventField,active=true}:{eventField?:string;active?:boolean}) {
  const input=useRef<HTMLInputElement>(null),manual=useRef(false),opened=useRef(Date.now());
  const [value,setValue]=useState(''),[suggested,setSuggested]=useState(false);
  useEffect(()=>{
    if(!active)return;opened.current=Date.now();
    const form=input.current?.form;if(!form)return;
    const update=()=>{
      if(manual.current)return;
      const fields=eventField?Array.from(form.elements).filter((field):field is HTMLInputElement=>field instanceof HTMLInputElement&&(eventField.endsWith("*")?field.name.startsWith(eventField.slice(0,-1)):field.name===eventField)):[];
      const dates=fields.map(field=>Date.parse(field.type==='date'?`${field.value}T00:00:00`:field.value)).filter(Number.isFinite);
      const deadline=eventField&&!dates.length?undefined:suggestedDeadline(opened.current,dates.length?Math.min(...dates):undefined);
      setValue(deadline===undefined?'':localDeadline(deadline));setSuggested(deadline!==undefined);
    };
    const reset=()=>{manual.current=false;opened.current=Date.now();queueMicrotask(update);};
    // Hidden ISO fields are updated by the time controls after their input event.
    const changed=(event:Event)=>{if(event.target!==input.current)requestAnimationFrame(update);};
    update();form.addEventListener('input',changed);form.addEventListener('change',changed);form.addEventListener('reset',reset);form.addEventListener('click',changed);
    return()=>{form.removeEventListener('input',changed);form.removeEventListener('change',changed);form.removeEventListener('reset',reset);form.removeEventListener('click',changed);};
  },[eventField,active]);
  return <label>Prazo de resposta (opcional)<input ref={input} name="deadline" type="datetime-local" value={value} min={localDeadline(Date.now()+60000)} onChange={event=>{manual.current=true;setSuggested(false);setValue(event.target.value);}}/><small className="availability-hint">{suggested?'Prazo sugerido. Ajuste se necessário.':'Sem prazo, as respostas permanecem abertas até o encerramento.'}</small></label>;
}
