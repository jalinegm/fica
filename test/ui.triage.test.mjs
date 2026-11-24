import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClass, parseLog, parseCompletion } from '../src/core.js';
import { generateDemo } from '../src/demo.js';
import { triageGroups, studentReason } from '../src/ui.js';

test('triage shows four groups in order and excludes regular students', () => {
  const d = generateDemo({ seed: 1, turma: 'Teste', start: '2026-03-02', weeks: 18, students: 40 });
  const c = buildClass({ name: 'Teste', log: parseLog(d.logText), completion: parseCompletion(d.completionText) });
  const groups = triageGroups(c);
  assert.deepEqual(groups.map(({ id }) => id), ['afastamento', 'queda', 'concentrado', 'irregular']);
  assert.equal(groups[0].label, 'Sem acesso ou afastamento');
  assert.equal(groups.reduce((total, group) => total + group.students.length, 0) +
    c.students.filter(row => row.pattern === 'regular').length, 40);
  for (const { students } of groups) {
    const days = students.map(row => row.daysSinceLast ?? Infinity);
    assert.deepEqual(days, [...days].sort((a, b) => b - a));
  }
});

test('the contact card gives a factual explanation for each pattern', () => {
  const row = { activeDays: ['2026-03-02', '2026-03-09'], daysSinceLast: 14, firstHalfWeeks: 8, secondHalfWeeks: 4, daysActive: 5, weeksActive: 6 };
  for (const [pattern, expected] of Object.entries({ 'sem-acesso': 'nenhum acesso na disciplina',
    afastamento: 'último acesso em 09/03 · 14 dias sem acesso', queda: '8 semanas com acesso na 1ª metade, 4 na 2ª',
    concentrado: 'acessos em 5 dias', irregular: '6 de 18 semanas com acesso', regular: '6 de 18 semanas com acesso' })) {
    assert.equal(studentReason({ ...row, pattern }, 18), expected);
  }
});
