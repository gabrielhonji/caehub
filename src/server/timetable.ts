import { spawn } from 'node:child_process';
import { Conflict } from './service.js';

export type TimetableRow = { weekday: number; code: string; startTime: string | null; endTime: string | null; needsReview: boolean };
type Word = { text: string; x: number; y: number; right: number; bottom: number };
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const weekday = (value: string) => ({ domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 } as Record<string, number>)[normalized(value).replace(/-feira$/, '')];
const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)));

/** Conservative table reader: never assigns clock times from the M/T/N code alone. */
export function parseTimetable(xml: string): { rows: TimetableRow[]; warnings: string[] } {
  const rows: TimetableRow[] = [];
  for (const page of xml.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)) {
    const words: Word[] = [...page[1].matchAll(/<word\b([^>]*)>([^<]*)<\/word>/g)].flatMap(match => {
      const attrs = Object.fromEntries([...match[1].matchAll(/(xMin|yMin|xMax|yMax)="([\d.-]+)"/g)].map(item => [item[1], Number(item[2])]));
      if (!['xMin', 'yMin', 'xMax', 'yMax'].every(key => Number.isFinite(attrs[key]))) return [];
      return [{ text: decode(match[2]).trim(), x: attrs.xMin, y: attrs.yMin, right: attrs.xMax, bottom: attrs.yMax }];
    });
    const headers = words.filter(word => weekday(word.text) !== undefined);
    const codes = words.filter(word => /^(M[1-6]|T[1-6]|N[1-5])$/i.test(word.text));
    for (const code of codes) {
      const candidates = headers.filter(header => header.y < code.y && header.x > code.right);
      if (!candidates.length) continue;
      const headerY = Math.max(...candidates.map(header => header.y));
      const columns = candidates.filter(header => Math.abs(header.y - headerY) < 5).sort((a, b) => a.x - b.x);
      // A single day label might be prose; require an actual multi-column table.
      if (columns.length < 2 || new Set(columns.map(column => weekday(column.text))).size !== columns.length) continue;
      const rowWords = words.filter(word => Math.abs((word.y + word.bottom) / 2 - (code.y + code.bottom) / 2) < 5 && word !== code);
      const printedRange = rowWords.filter(word => word.right < columns[0].x).sort((a, b) => a.x - b.x).map(word => word.text).join(' ');
      const clock = printedRange.match(/^([01]\d|2[0-3])[:h]([0-5]\d)\s*(?:-|–|a|às)?\s+([01]\d|2[0-3])[:h]([0-5]\d)$/i)
        ?? printedRange.match(/^([01]\d|2[0-3])[:h]([0-5]\d)\s*(?:-|–|a|às)\s*([01]\d|2[0-3])[:h]([0-5]\d)$/i);
      const startTime = clock ? `${clock[1]}:${clock[2]}` : null;
      const endTime = clock ? `${clock[3]}:${clock[4]}` : null;
      for (const [index, column] of columns.entries()) {
        const center = (column.x + column.right) / 2;
        const left = index === 0 ? (code.right + center) / 2 : ((columns[index - 1].x + columns[index - 1].right) / 2 + center) / 2;
        const right = index + 1 === columns.length ? center + (center - left) : (center + (columns[index + 1].x + columns[index + 1].right) / 2) / 2;
        const occupied = rowWords.some(word => word.x >= columns[0].x - 5 && (word.x + word.right) / 2 >= left && (word.x + word.right) / 2 < right && !/^[-–—.]$/.test(word.text) && !/^[0-9:h]+$/.test(word.text));
        if (occupied) rows.push({ weekday: weekday(column.text), code: code.text.toUpperCase(), startTime, endTime, needsReview: !startTime || !endTime || startTime >= endTime });
      }
    }
  }
  const unique = [...new Map(rows.map(row => [`${row.weekday}/${row.code}/${row.startTime}/${row.endTime}`, row])).values()];
  const warnings = ['Confira cada dia e intervalo antes de confirmar. Códigos M/T/N não definem horários universais.'];
  if (!unique.length) warnings.push('Tabela não reconhecida. PDF escaneado ou estrutura diferente: adicione os horários manualmente. Nenhuma aula foi presumida.');
  if (unique.some(row => row.needsReview)) warnings.push('Há intervalos sem horário textual seguro. Preencha o início e o fim usando seu documento.');
  return { rows: unique.slice(0, 200), warnings };
}

let running = 0;
export async function extractTimetable(pdf: Buffer) {
  if (pdf.length > 5 * 1024 * 1024 || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Conflict('Envie um PDF válido de até 5 MB.');
  if (running >= 2) throw new Conflict('Há outras importações em andamento. Tente novamente.');
  running++;
  try {
    const xml = await new Promise<string>((resolve, reject) => {
      const child = spawn('pdftotext', ['-f', '1', '-l', '10', '-bbox-layout', '-', '-'], { stdio: ['pipe', 'pipe', 'ignore'] });
      const chunks: Buffer[] = []; let size = 0, finished = false;
      const finish = (error?: Error) => { if (finished) return; finished = true; clearTimeout(timer); if (error) { child.kill('SIGKILL'); reject(error); } else resolve(Buffer.concat(chunks).toString('utf8')); };
      const timer = setTimeout(() => finish(new Conflict('A extração excedeu o tempo permitido. Corrija a grade manualmente.')), 8000);
      child.on('error', () => finish(new Conflict('Extração de PDF indisponível neste ambiente.')));
      child.stdin.on('error', () => finish(new Conflict('Não foi possível ler o PDF.')));
      child.stdout.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 4 * 1024 * 1024) finish(new Conflict('PDF com texto excessivo. Use somente as páginas da grade.')); else chunks.push(chunk); });
      child.on('close', code => finish(code === 0 ? undefined : new Conflict('PDF ilegível ou protegido. Use a correção manual.')));
      child.stdin.end(pdf);
    });
    return parseTimetable(xml);
  } finally { running--; }
}
