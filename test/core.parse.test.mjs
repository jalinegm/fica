import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FormatError, parseCSV, parseMoodleDate, parseLog } from '../src/core.js';

const pt = 'Hora,"Nome completo","Usuário afetado","Contexto do Evento",Componente,"Nome do evento",Descrição,Origem,"endereço IP"';
const en = 'Time,User full name,Affected user,Event context,Component,Event name,Description,Origin,IP address';
const row = (date, context) => `"${date}",Ana Exemplo,,"${context}",Sistema,Acesso,,web,0.0.0.0`;

test('CSV accepts BOM, escaped quotes and line breaks', () => {
  assert.deepEqual(parseCSV('\uFEFFa,"b ""x""","c\nd"\r\n1,2,3'), [['a', 'b "x"', 'c\nd'], ['1', '2', '3']]);
});

test('Moodle dates are parsed locally and checked for validity', () => {
  for (const [value, expected] of [
    ['23/11/26, 17:18:41', [2026, 10, 23, 17, 18, 41]],
    ['05/03/2024, 08:01', [2024, 2, 5, 8, 1, 0]],
    ['23 November 2026, 5:18:41 PM', [2026, 10, 23, 17, 18, 41]],
    ['2 March 2026, 12:03 AM', [2026, 2, 2, 0, 3, 0]],
  ]) {
    const d = parseMoodleDate(value);
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()], expected);
  }
  for (const invalid of ['ontem', '31/02/26, 08:01', '23/11/26, 29:00']) assert.equal(parseMoodleDate(invalid), null);
});

test('logs use named headers, ignore bad rows, and discard IP addresses', () => {
  const valid = row('23/11/26, 17:18:41', 'Curso: Introdução a Informática ');
  const result = parseLog([pt, valid, row('ontem', 'Outro'), valid].join('\n'));
  assert.equal(result.course, 'Introdução a Informática');
  assert.equal(result.events.length, 2);
  assert.deepEqual(Object.keys(result.events[0]), ['time', 'user', 'event', 'component', 'origin']);
  assert.equal(parseLog(en + '\n' + row('23 November 2026, 5:18 PM', 'Course: Example')).language, 'en');
});

test('the log rejects a completion report, spreadsheet and unknown dates', () => {
  for (const [input, code] of [[',"Endereço de email"', 'is-completion'], ['PK\u0003\u0004', 'not-csv'], ['a,b', 'not-log'], [pt + '\n' + row('ontem', 'Curso'), 'bad-date']]) {
    assert.throws(() => parseLog(input), error => error instanceof FormatError && error.code === code && (code !== 'not-csv' || error.message.includes('CSV')));
  }
});
