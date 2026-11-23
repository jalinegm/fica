import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildClass, parseLog, parseCompletion, summarizeClass } from '../src/core.js';
import { generateDemo } from '../src/demo.js';
import { compareRows, spearman } from '../src/ui.js';

test('comparison rows show two offerings and format percentages in Brazilian Portuguese', () => {
  const summaries = [2025, 2026].map(year => {
    const demo = generateDemo({ seed: year, turma: String(year), start: '2026-03-02', weeks: 18, students: 37 });
    return summarizeClass(buildClass({ name: String(year), log: parseLog(demo.logText),
      completion: year === 2026 ? parseCompletion(demo.completionText) : null }));
  });
  const rows = compareRows(summaries);
  assert.equal(rows.length, 13);
  assert.ok(rows.every(row => row.values.length === 2));
  assert.ok(rows.some(row => row.values.some(value => /,\d+%/.test(value))));
  assert.equal(rows.at(-1).values[0], '—');
});

test('Spearman ranks ties correctly and avoids undefined results for constant samples', () => {
  assert.equal(spearman([{ x: 1, y: 10 }, { x: 1, y: 10 }, { x: 2, y: 20 }, { x: 3, y: 30 }]), 1);
  assert.equal(spearman([{ x: 1, y: 30 }, { x: 2, y: 20 }, { x: 3, y: 10 }]), -1);
  assert.equal(spearman([{ x: 1, y: 10 }, { x: 1, y: 20 }]), 0);
});
