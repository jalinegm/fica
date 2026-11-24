import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClass, parseLog, parseCompletion, PATTERNS, weeklySeries } from '../src/core.js';
import { DEMO_OFFERINGS, generateDemo } from '../src/demo.js';

test('fictitious Moodle exports are repeatable and illustrate every pattern', () => {
  const options = { seed: 1, turma: '2026/1', start: '2026-03-02', weeks: 18, students: 40 };
  const demo = generateDemo(options);
  assert.deepEqual(demo, generateDemo(options));
  assert.notDeepEqual(demo, generateDemo({ ...options, seed: 2 }));
  assert.ok(demo.logText.startsWith('\uFEFF'));
  const c = buildClass({ name: options.turma, log: parseLog(demo.logText), completion: parseCompletion(demo.completionText) });
  assert.equal(c.students.length, 40);
  assert.equal(c.weeks, 18);
  assert.equal(c.staff.length, 2);
  for (const { id } of PATTERNS) assert.ok(c.students.some(row => row.pattern === id), id);
});

test('example offerings use distinct first names only and show different second-half access', () => {
  const classes = DEMO_OFFERINGS.map(options => {
    const demo = generateDemo(options);
    const completion = parseCompletion(demo.completionText);
    assert.equal(new Set(completion.students.map(row => row.name)).size, options.students);
    assert.ok(completion.students.every(row => !row.name.includes(' ')));
    const c = buildClass({ name: options.turma, log: parseLog(demo.logText), completion });
    assert.equal(c.students.length, options.students);
    assert.equal(c.weeks, options.weeks);
    return c;
  });
  const average = series => series.reduce((sum, row) => sum + row.pct, 0) / series.length;
  const [earlier, later] = classes.map(weeklySeries);
  assert.ok(average(earlier.slice(0, 9)) - average(earlier.slice(9)) >= 20);
  assert.ok(average(later.slice(9)) - average(earlier.slice(9)) >= 15);
});
