import type {Priority} from '../domain/types';

/** Native fields: the surrounding form owns submission, reset and permissions. */
export function CardScheduleFields({priority='normal',dueAt,disabled=false}:{priority?:Priority;dueAt?:string|null;disabled?:boolean}) {
  const today=new Date(),minimum=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  return <div className="card-schedule-fields"><fieldset className="priority-choices" disabled={disabled}><legend>Prioridade</legend>{([['low','Baixa'],['normal','Normal'],['high','Alta']] as const).map(([value,label])=><label key={value} data-priority={value}><input type="radio" name="priority" value={value} defaultChecked={priority===value}/><span>{label}</span></label>)}</fieldset><label className="card-due-field">Prazo<input disabled={disabled} name="dueAt" type="date" min={minimum} defaultValue={dueAt?.slice(0,10)}/></label></div>;
}
