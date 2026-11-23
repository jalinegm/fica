import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClass, parseLog, parseCompletion, PATTERNS } from '../src/core.js';
import { generateDemo } from '../src/demo.js';

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
