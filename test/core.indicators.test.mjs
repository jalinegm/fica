import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClass, dayKey, daysBetween, proposePeriod } from '../src/core.js';

const event = (date, user = 'Ana Exemplo', origin = 'web') => ({ time: new Date(date + 'T12:00:00'), user, origin });
const period = { start: '2026-03-02', end: '2026-03-29' };
const build = (events, options = {}) => buildClass({ name: 'Teste', log: { events }, period, ...options });

test('indicators use local days and ignore system and out-of-period events', () => {
  const c = build([
    event('2026-03-01'), event('2026-03-02'), event('2026-03-02'), event('2026-03-02', 'Ana Exemplo', 'ws'),
    event('2026-03-09'), event('2026-03-29', 'Ana Exemplo', 'cli'), event('2026-03-30'),
  ]);
  assert.equal(c.refDate, '2026-03-29');
  const [row] = c.students;
  assert.equal(row.accesses, 4);
  assert.equal(row.daysActive, 2);
  assert.deepEqual(row.weeklyDays, [1, 1, 0, 0]);
  assert.deepEqual([row.weeksActive, row.firstHalfWeeks, row.secondHalfWeeks], [2, 2, 0]);
  assert.deepEqual([row.longestAbsence, row.daysSinceLast, row.gaps7, row.gaps14, row.gaps21], [20, 20, 1, 1, 0]);
  assert.equal(dayKey(event('2026-03-02').time), '2026-03-02');
  assert.equal(daysBetween('2026-03-07', '2026-03-10'), 3);
});

test('offering dates ignore a sparse tail and fall back to any student access', () => {
  const names = Array.from({ length: 10 }, (_, i) => 'Estudante ' + i);
  const events = names.map(name => event('2026-03-03', name));
  events.push(event('2026-06-08', names[0]));
  assert.deepEqual(proposePeriod(events, names), { start: '2026-03-02', end: '2026-03-08' });
  assert.deepEqual(proposePeriod([events.at(-1)], names), { start: '2026-06-08', end: '2026-06-14' });
});

test('the middle week belongs to the first half and reference can precede the end', () => {
  const c = build([event('2026-03-16'), event('2026-03-23')], { period: { ...period, end: '2026-04-05' } });
  assert.equal(c.weeks, 5);
  assert.equal(c.refDate, '2026-03-23');
  assert.deepEqual([c.students[0].firstHalfWeeks, c.students[0].secondHalfWeeks], [1, 1]);
});

test('a one-week offering supports last-day access and enrolled students without access', () => {
  const options = { period: { start: '2026-03-02', end: '2026-03-08' } };
  const single = build([event('2026-03-08')], options);
  assert.deepEqual([single.weeks, single.students[0].longestAbsence, single.students[0].daysSinceLast], [1, 6, 0]);
  assert.ok(Object.values(single.students[0]).every(value => !Number.isNaN(value)));
  const c = build([event('2026-03-08')], {
    ...options, completion: { activities: ['A'], students: [{ name: 'Bia Exemplo', done: [false] }] },
  });
  assert.deepEqual([c.students[0].longestAbsence, c.students[0].daysSinceLast, c.students[0].gaps7], [7, null, 1]);
});
