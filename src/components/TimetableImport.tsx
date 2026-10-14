import { useRef, useState } from 'react';
import { confirmTimetable, previewTimetable, setAvailabilityException, type AvailabilityBlock, type TimetablePreviewRow } from '../services/agenda';
import { timetableIssues } from '../domain/agenda-input';
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
  const [pdf,setPdf]=useState<File>();
  const [term,setTerm]=useState(''),[validFrom,setValidFrom]=useState(''),[validTo,setValidTo]=useState(''),[reviewed,setReviewed]=useState(false);
  const issues=timetableIssues({term,validFrom,validTo,reviewed,rows});
  const nextKey = useRef(0);
  const update = (key: number, patch: Partial<EditableRow>) => {setReviewed(false);setRows(current => current.map(row => row.key === key ? { ...row, ...patch } : row));};
  const manual = () => { const key = nextKey.current++; setMessage(''); setReviewed(false);setPreview(true); setRows(current => [...current, { key, weekday: 1, code: 'Manual', startTime: null, endTime: null, needsReview: true }]); };
  return <><AgendaSummary eyebrow="GRADE ACADÊMICA · UTFPR" title="Grade acadêmica" description="Importe suas aulas, confira os horários e mantenha sua disponibilidade atualizada."><Button onClick={()=>setOpen(true)}>Importar grade</Button></AgendaSummary>
    <AgendaWorkflow busy={busy} title="Importar grade acadêmica" open={open} onClose={()=>setOpen(false)}>
    <p>1. Envie o PDF ou preencha manualmente. 2. Confira os horários e o período. 3. Confirme para salvar.</p>
    <p>PDF de até 5 MB. A extração lê texto e posições das dez primeiras páginas; documentos escaneados precisam de preenchimento manual.</p>
    <details className="timetable-pdf-help"><summary>Como gerar o PDF das disciplinas na UTFPR</summary><p><a href="https://sistemas2.utfpr.edu.br/dpls/sistema/aluno10/mpmenu.inicio" target="_blank" rel="noopener noreferrer">Abrir Portal do Aluno da UTFPR ↗</a> (abre em outra aba).</p><ol><li>Faça login, se necessário.</li><li>Abra o menu.</li><li>Escolha <strong>Disciplinas Matriculadas</strong>.</li><li>Clique em <strong>Gerar impressão</strong>.</li><li>Na nova tela, desça até o final da página e clique em <strong>imprimir</strong>.</li><li>Em <strong>destino</strong>, escolha <strong>Salvar como PDF</strong>.</li><li>Envie o PDF no campo <strong>PDF de horários</strong> abaixo, prepare a prévia e confira as disciplinas antes de salvar.</li></ol></details>
    <form className="agenda-form" onSubmit={async event => {
      event.preventDefault(); const file = pdf;
      if (!(file instanceof File) || !file.size) return;
      setBusy(true); setMessage('');
      try { const result = await previewTimetable(file); setRows(result.rows.map(row => ({ ...row, key: nextKey.current++ }))); setWarnings(result.warnings); setReviewed(false);setPreview(true); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível extrair a grade.'); }
      finally { setBusy(false); }
    }}><label className="wide-field">PDF de horários<input type="file" name="pdf" accept="application/pdf,.pdf" required disabled={busy} onChange={e=>{setPdf(e.target.files?.[0]);setPreview(false);setReviewed(false);}}/></label><div className="form-actions"><Button disabled={busy||!pdf}>{busy ? 'Lendo PDF…' : 'Preparar prévia'}</Button><Button type="button" onClick={manual} disabled={busy}>Preencher manualmente</Button></div></form>
    {preview && <form className="agenda-form" onSubmit={async event => {
      event.preventDefault();if(issues.length||busy)return;
      setBusy(true); setMessage('');
      try { await confirmTimetable({ term:term.trim(), validFrom, validTo, confirmed: true, rows: rows.map(row => ({ weekday: row.weekday, startTime: row.startTime ?? '', endTime: row.endTime ?? '' })) }); setMessage('Grade salva. Os horários serão ocupados somente durante o período letivo.'); setPreview(false);setRows([]);setWarnings([]);setReviewed(false); await onSaved(); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
      finally { setBusy(false); }
    }}><div className="wide-field" role="status">{warnings.map(warning => <p key={warning}>{warning}</p>)}</div>
      <label>Período letivo<input name="term" required maxLength={80} placeholder="2026/2" disabled={busy} value={term} onChange={e=>{setTerm(e.target.value);setReviewed(false);}}/></label><label>Primeiro dia<input type="date" name="validFrom" required disabled={busy} value={validFrom} onChange={e=>{setValidFrom(e.target.value);setReviewed(false);}}/></label><label>Último dia<input type="date" name="validTo" required disabled={busy} min={validFrom||undefined} value={validTo} onChange={e=>{setValidTo(e.target.value);setReviewed(false);}}/></label>
      <div className="wide-field">{rows.map((row,index) => <fieldset className="agenda-form timetable-row" key={row.key} disabled={busy}><legend>Bloco {index+1} · {days[row.weekday]} <Badge tone={row.startTime&&row.endTime&&row.endTime>row.startTime?'active':'waiting'}>{row.startTime&&row.endTime&&row.endTime>row.startTime?'Preenchido':'Pendente'}</Badge></legend><label>Dia<select value={row.weekday} onChange={event => update(row.key, { weekday: Number(event.target.value) })}>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label>Início<input type="time" required value={row.startTime ?? ''} onChange={event => update(row.key, { startTime: event.target.value })}/></label><label>Fim<input type="time" required min={row.startTime??undefined} value={row.endTime ?? ''} onChange={event => update(row.key, { endTime: event.target.value })}/></label><Button type="button" onClick={() => {setReviewed(false);setRows(current => current.filter(item => item.key !== row.key));}}>Remover aula</Button></fieldset>)}</div>
      {!rows.length && <p className="wide-field">Nenhuma aula detectada. Adicione os intervalos usando seu PDF.</p>}
      <Button type="button" onClick={manual} disabled={busy}>Adicionar aula</Button>
      <fieldset className="participant-picker"><legend>Revisão da grade</legend><label className="inline-check"><input type="checkbox" required disabled={busy} checked={reviewed} onChange={e=>setReviewed(e.target.checked)}/><span>Conferi todos os dias e horários. Ao reimportar o mesmo período, a nova grade substitui a grade importada anterior; blocos manuais são preservados.</span></label></fieldset>
      {issues.length>0&&<div className="validation-summary wide-field" role="status"><strong>Antes de concluir:</strong><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}<Button variant="primary" disabled={busy || issues.length>0}>{busy ? 'Salvando…' : 'Confirmar e salvar grade'}</Button>
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
