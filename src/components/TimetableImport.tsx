import { useRef, useState } from 'react';
import { confirmTimetable, previewTimetable, setAvailabilityException, type AvailabilityBlock, type TimetablePreviewRow } from '../services/agenda';
import { Badge, Button } from './primitives';
import { AgendaSummary, AgendaWorkflow } from './AgendaWorkflow';

const days = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
type EditableRow = TimetablePreviewRow & { key: number };
/** Composes existing agenda form controls; owns the PDF review and confirmation flow. */
export function TimetableImport({ onSaved }: { onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [open,setOpen]=useState(false);
  const nextKey = useRef(0);
  const update = (key: number, patch: Partial<EditableRow>) => setRows(current => current.map(row => row.key === key ? { ...row, ...patch } : row));
  const manual = () => { const key = nextKey.current++; setMessage(''); setPreview(true); setRows(current => [...current, { key, weekday: 1, code: 'Manual', startTime: null, endTime: null, needsReview: true }]); };
  return <><AgendaSummary eyebrow="GRADE ACADÊMICA · UTFPR" title="Grade acadêmica" description="Importe suas aulas, confira os horários e mantenha sua disponibilidade atualizada."><Button onClick={()=>setOpen(true)}>Importar grade</Button></AgendaSummary>
    <AgendaWorkflow busy={busy} title="Importar grade acadêmica" open={open} onClose={()=>setOpen(false)}>
    <p>1. Envie o PDF ou preencha manualmente. 2. Confira os horários e o período. 3. Confirme para salvar.</p>
    <p>PDF de até 5 MB. A extração lê texto e posições das dez primeiras páginas; documentos escaneados precisam de preenchimento manual.</p>
    <form className="agenda-form" onSubmit={async event => {
      event.preventDefault(); const file = new FormData(event.currentTarget).get('pdf');
      if (!(file instanceof File) || !file.size) return;
      setBusy(true); setMessage('');
      try { const result = await previewTimetable(file); setRows(result.rows.map(row => ({ ...row, key: nextKey.current++ }))); setWarnings(result.warnings); setPreview(true); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível extrair a grade.'); }
      finally { setBusy(false); }
    }}><label className="wide-field">PDF de horários<input type="file" name="pdf" accept="application/pdf,.pdf" required disabled={busy}/></label><div className="form-actions"><Button disabled={busy}>{busy ? 'Lendo PDF…' : 'Preparar prévia'}</Button><Button type="button" onClick={manual} disabled={busy}>Preencher manualmente</Button></div></form>
    {preview && <form className="agenda-form" onSubmit={async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      setBusy(true); setMessage('');
      try { await confirmTimetable({ term: String(data.get('term')), validFrom: String(data.get('validFrom')), validTo: String(data.get('validTo')), confirmed: true, rows: rows.map(row => ({ weekday: row.weekday, startTime: row.startTime ?? '', endTime: row.endTime ?? '' })) }); setMessage('Grade salva. Os horários serão ocupados somente durante o período letivo.'); setPreview(false); await onSaved(); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
      finally { setBusy(false); }
    }}><div className="wide-field" role="status">{warnings.map(warning => <p key={warning}>{warning}</p>)}</div>
      <label>Período letivo<input name="term" required maxLength={80} placeholder="2026/2" disabled={busy}/></label><label>Primeiro dia<input type="date" name="validFrom" required disabled={busy}/></label><label>Último dia<input type="date" name="validTo" required disabled={busy}/></label>
      <div className="wide-field">{rows.map(row => <fieldset className="agenda-form timetable-row" key={row.key} disabled={busy}><legend>{row.code} <Badge tone="waiting">Conferir</Badge></legend><label>Dia<select value={row.weekday} onChange={event => update(row.key, { weekday: Number(event.target.value) })}>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Início<input type="time" required value={row.startTime ?? ''} onChange={event => update(row.key, { startTime: event.target.value })}/></label><label>Fim<input type="time" required value={row.endTime ?? ''} onChange={event => update(row.key, { endTime: event.target.value })}/></label><Button type="button" onClick={() => setRows(current => current.filter(item => item.key !== row.key))}>Remover aula</Button></fieldset>)}</div>
      {!rows.length && <p className="wide-field">Nenhuma aula detectada. Adicione os intervalos usando seu PDF.</p>}
      <Button type="button" onClick={manual} disabled={busy}>Adicionar aula</Button>
      <fieldset className="participant-picker"><legend>Revisão da grade</legend><label><input type="checkbox" required disabled={busy}/><span>Conferi todos os dias e horários. Ao reimportar o mesmo período, a nova grade substitui a grade importada anterior; blocos manuais são preservados.</span></label></fieldset>
      <Button variant="primary" disabled={busy || !rows.length}>{busy ? 'Salvando…' : 'Confirmar e salvar grade'}</Button>
    </form>}
    {message && <p className="form-feedback" role="status">{message}</p>}
  </AgendaWorkflow></>;
}

export function AvailabilityExceptions({ block, act }: { block: AvailabilityBlock; act: (work: () => Promise<unknown>, message: string) => Promise<unknown> }) {
  const excluded: string[] = (typeof block.excludedDates === 'string' ? JSON.parse(block.excludedDates) : block.excludedDates) ?? [];
  const [busy, setBusy] = useState(false);
  const change = async (date: string, value: boolean) => { setBusy(true); try { await act(() => setAvailabilityException(block.id, date, value), value ? 'Ocorrência liberada.' : 'Ocorrência restaurada.'); } finally { setBusy(false); } };
  if (block.kind !== 'weekly') return null;
  return <details className="availability-exceptions"><summary>Exceções por data</summary>{block.term && <p>{block.term} · {block.validFrom} a {block.validTo}</p>}<form className="agenda-form" onSubmit={event => { event.preventDefault(); void change(String(new FormData(event.currentTarget).get('date')), true); }}><label>Dia sem este compromisso<input type="date" name="date" required disabled={busy} min={block.validFrom ?? undefined} max={block.validTo ?? undefined}/></label><Button disabled={busy}>Liberar ocorrência</Button></form>{excluded.map(date => <p key={date}>{date} <Button disabled={busy} onClick={() => void change(date, false)}>Restaurar</Button></p>)}</details>;
}
