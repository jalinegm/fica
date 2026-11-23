import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPattern, summarizeClass, titleWeekly, titleCompare, titlePatterns, weeklySeries } from '../src/core.js';

const regular = { accesses: 16, daysSinceLast: 1, weeksActive: 16, daysActive: 16,
  weeklyDays: Array(16).fill(1), longestAbsence: 6, firstHalfWeeks: 8, secondHalfWeeks: 8 };
test('patterns use ordered thresholds and the configured absence limit', () => {
  const cases = {
    'sem-acesso': { accesses: 0, daysSinceLast: null },
    afastamento: { daysSinceLast: 20, secondHalfWeeks: 3 },
    queda: { secondHalfWeeks: 4 },
    concentrado: { weeksActive: 3, daysActive: 5, weeklyDays: [3, 1, 1], firstHalfWeeks: 1 },
    irregular: { weeksActive: 10 },
    regular: {},
  };
  for (const [expected, fields] of Object.entries(cases)) {
    assert.equal(classifyPattern({ ...regular, ...fields }, 18, 14), expected);
  }
  assert.equal(classifyPattern({ ...regular, ...cases.afastamento }, 18, 21), 'queda');
  assert.equal(classifyPattern({ ...regular, longestAbsence: 14 }, 18, 14), 'irregular');
});

test('summary calculates even medians and weekly series count each student once', () => {
  const c = { name: 'Exemplo', period: { start: '2026-03-02', end: '2026-04-26' }, weeks: 8, staff: [],
    students: [2, 4, 6, 8].map(weeksActive => ({ ...regular, weeksActive, pattern: 'regular',
      weeklyDays: [2, ...Array(7).fill(0)], completed: weeksActive, completionTotal: 8 })) };
  const summary = summarizeClass(c);
  assert.equal(summary.medianWeeksActive, 5);
  assert.equal(summarizeClass({ ...c, students: c.students.slice(0, 3).concat({ ...c.students[0], weeksActive: 3 }) }).meanWeeksActive, 3.8);
  assert.equal(summary.medianCompletionPct, 62.5);
  assert.equal(summary.patternPct.regular, 100);
  assert.deepEqual(weeklySeries(c).slice(0, 2), [{ week: 1, n: 4, pct: 100 }, { week: 2, n: 0, pct: 0 }]);
  assert.equal(titlePatterns(summary), 'Todos os estudantes tiveram acesso regular');
});

test('weekly and comparison titles describe the sustained decline or the final difference', () => {
  const series = values => values.map((pct, i) => ({ week: i + 1, pct }));
  assert.equal(titleWeekly(series([90, 80, 60, 45, 40, 30])), 'A partir da semana 4, menos da metade da turma acessou o curso');
  assert.equal(titleWeekly(series([90, 85, 80, 75, 70, 65])), 'O acesso caiu de 90% na semana 1 para 65% na última semana');
  assert.equal(titleCompare([{ name: 'A', series: series([80, 20]) }, { name: 'B', series: series([10, 80]) }]),
    'B manteve mais estudantes acessando até o fim da oferta');
});

test('short and recovering series produce titles supported by the data', () => {
  const series = values => values.map((pct, i) => ({ week: i + 1, pct }));
  assert.equal(titleCompare([{ name: 'A', series: series([25]) }, { name: 'B', series: series([100]) }]),
    'B manteve mais estudantes acessando até o fim da oferta');
  assert.equal(titleWeekly(series([80, 30, 80])), 'Em 2 de 3 semanas, mais da metade da turma acessou o curso');
});
