import assert from 'node:assert/strict';
import test from 'node:test';
import { extractTimetable, parseTimetable } from './timetable.js';
import { occurrenceApplies } from './timetable-service.js';

const word = (text: string, x: number, y: number, width = 40) => `<word xMin="${x}" yMin="${y}" xMax="${x + width}" yMax="${y + 10}">${text}</word>`;
const table = (range = '') => `<page>${word('Segunda', 160, 10)}${word('Terça', 300, 10)}${word('Quarta', 440, 10)}${word('M1', 10, 30)}${range ? word(range, 55, 30, 90) : ''}${word('Disciplina', 160, 30)}${word('-', 300, 30)}${word('Laboratório', 440, 30)}</page>`;

test('table coordinates preserve occupied days and printed times, without exposing discipline names', () => {
  const result = parseTimetable(table('07:30–08:20'));
  assert.deepEqual(result.rows.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })), [
    { weekday: 1, startTime: '07:30', endTime: '08:20' }, { weekday: 3, startTime: '07:30', endTime: '08:20' },
  ]);
  assert.equal(JSON.stringify(result).includes('Disciplina'), false);
  assert.equal(result.rows.some(row => row.weekday === 2), false);
});

test('missing textual times stay unknown; duplicate pages do not duplicate candidates', () => {
  const result = parseTimetable(table() + table());
  assert.equal(result.rows.length, 2);
  assert.ok(result.rows.every(row => row.needsReview && row.startTime === null && row.endTime === null));
});

test('left-aligned first-day cells are retained while clocks and empty neighboring cells stay empty', () => {
  const xml=`<page>${word('Segunda',160,10)}${word('Terça',300,10)}${word('M1',10,30)}${word('07h30',55,30)}${word('08h20',105,30)}${word('AULA',150,30)}${word('-',300,30)}</page>`;
  assert.deepEqual(parseTimetable(xml).rows,[{weekday:1,code:'M1',startTime:'07:30',endTime:'08:20',needsReview:false}]);
  assert.deepEqual(parseTimetable(xml.replace(word('AULA',150,30),'')).rows,[]);
});

test('consolidation includes printed recesses but never bridges an empty period or morning/afternoon', () => {
  const row=(code:string,range:string,y:number,occupied=true)=>word(code,10,y)+word(range,55,y,90)+(occupied?word('AULA',150,y):word('-',150,y));
  const xml=`<page>${word('Segunda',160,10)}${word('Terça',300,10)}${row('M1','07:30–08:20',30)}${row('M2','08:40–09:30',50)}${row('M3','09:30–10:20',70,false)}${row('M4','10:20–11:10',90)}${row('T1','13:00–13:50',110)}</page>`;
  assert.deepEqual(parseTimetable(xml).rows.map(r=>[r.weekday,r.startTime,r.endTime]),[[1,'07:30','09:30'],[1,'10:20','11:10'],[1,'13:00','13:50']]);
});

test('UTFPR layout accepts two printed clock columns without inventing code mappings', () => {
  const xml = `<page>${word('Segunda', 160, 10)}${word('Terça', 300, 10)}${word('M1', 10, 30)}${word('07h30', 55, 30)}${word('08h20', 105, 30)}${word('AULA', 300, 30)}</page>`;
  const result = parseTimetable(xml);
  assert.deepEqual(result.rows, [{ weekday: 2, code: 'M1', startTime: '07:30', endTime: '08:20', needsReview: false }]);
  const ambiguous = xml.replace(word('08h20', 105, 30), word('08h20 09h10', 105, 30));
  assert.equal(parseTimetable(ambiguous).rows[0].startTime, null);
});

test('scanned documents and unfamiliar layouts return manual correction instead of invented lessons', () => {
  assert.deepEqual(parseTimetable('<page></page>').rows, []);
  assert.deepEqual(parseTimetable(`<page>${word('Segunda', 160, 10)}${word('M1', 10, 30)}${word('Disciplina', 160, 30)}</page>`).rows, []);
});

test('invalid upload is rejected before starting a PDF process', async () => {
  await assert.rejects(extractTimetable(Buffer.from('not a PDF')), /PDF válido/);
});

test('academic period and per-date exceptions apply to recurrence; null SQL aggregation is safe', () => {
  const block = { kind: 'weekly', weekday: 1, validFrom: '2026-11-01', validTo: '2026-11-30', excludedDates: ['2026-11-09'] };
  assert.equal(occurrenceApplies(block, '2026-11-02', 1), true);
  assert.equal(occurrenceApplies(block, '2026-11-09', 1), false);
  assert.equal(occurrenceApplies(block, '2026-12-07', 1), false);
  assert.equal(occurrenceApplies(block, '2026-10-26', 1), false);
  assert.equal(occurrenceApplies(block, '2026-11-03', 2), false);
  assert.equal(occurrenceApplies({ kind: 'weekly', weekday: 1, excludedDates: 'null' }, '2026-11-02', 1), true);
});
