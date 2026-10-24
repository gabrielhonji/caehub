import type {Priority} from '../domain/types';

/** Native fields: the surrounding form owns submission, reset and permissions. */
export function CardScheduleFields({priority='normal',dueAt,disabled=false}:{priority?:Priority;dueAt?:string|null;disabled?:boolean}) {
  return <><fieldset className="priority-choices" disabled={disabled}><legend>Prioridade</legend>{([['low','Baixa'],['normal','Normal'],['high','Alta']] as const).map(([value,label])=><label key={value}><input type="radio" name="priority" value={value} defaultChecked={priority===value}/><span>{label}</span></label>)}</fieldset><label>Prazo<input disabled={disabled} name="dueAt" type="date" defaultValue={dueAt?.slice(0,10)}/></label></>;
}
