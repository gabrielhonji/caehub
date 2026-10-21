import type {Priority} from '../domain/types';

/** Native fields: the surrounding form owns submission, reset and permissions. */
export function CardScheduleFields({priority='normal',dueAt,disabled=false}:{priority?:Priority;dueAt?:string|null;disabled?:boolean}) {
  return <><label>Prioridade<select disabled={disabled} name="priority" defaultValue={priority}>
    <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option>
  </select></label><label>Prazo<input disabled={disabled} name="dueAt" type="date" defaultValue={dueAt?.slice(0,10)}/></label></>;
}
