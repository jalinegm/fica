import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCompletion, normalizeName, identifyPeople, assignCodes } from '../src/core.js';

const csv = ',"Endereço de email","Atividade\n  1",,Atividade 2,\nAna Souza,ana@example.invalid,Concluído,,Não concluído,\nBia Exemplo,,Não concluído,,Concluído,';
const events = [
  { user: 'Professora Exemplo', event: 'O envio foi avaliado.', origin: 'web' },
  { user: 'ana  souza', event: 'Acesso', origin: 'web' },
  { user: 'Caio Exemplo', event: 'Acesso', origin: 'ws' },
  { user: 'Sistema', event: 'Rotina', origin: 'cli' },
];

test('completion reports read multiline activity titles and completion status', () => {
  const { activities, students } = parseCompletion(csv);
  assert.deepEqual(activities, ['Atividade 1', 'Atividade 2']);
  assert.deepEqual(students[0], { name: 'Ana Souza', email: 'ana@example.invalid', done: [true, false] });
  assert.deepEqual(students[1].done, [false, true]);
  assert.deepEqual(parseCompletion(',Email address,Quiz,\nAna,,Completed,').students[0].done, [true]);
  assert.throws(() => parseCompletion('Hora,Nome completo,Nome do evento'), { code: 'is-log' });
  assert.throws(() => parseCompletion('PK\u0003\u0004'), { code: 'not-csv' });
});

test('people are matched by normalized names and overrides move them between roles', () => {
  assert.equal(normalizeName('  José  da SILVA '), 'jose da silva');
  assert.deepEqual(identifyPeople(events, null), {
    students: ['ana  souza', 'Caio Exemplo'], staff: ['Professora Exemplo'], source: 'heuristic',
  });
  const completion = parseCompletion(csv);
  assert.deepEqual(identifyPeople(events, completion), {
    students: ['Ana Souza', 'Bia Exemplo'], staff: ['Professora Exemplo', 'Caio Exemplo', 'Sistema'], source: 'completion',
  });
  const edited = identifyPeople(events, completion, { staff: ['bia exemplo'], students: ['CAIO EXEMPLO'] });
  assert.deepEqual(edited.students, ['Ana Souza', 'Caio Exemplo']);
  assert.ok(edited.staff.includes('Bia Exemplo'));
});

test('codes follow alphabetical order and use three digits above 99', () => {
  assert.deepEqual([...assignCodes(['Bia', 'ana', 'Carlos'])], [['ana', 'E01'], ['Bia', 'E02'], ['Carlos', 'E03']]);
  assert.equal(assignCodes(Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'))).get('00'), 'E001');
});
