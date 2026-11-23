import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineChart, patternBars } from '../src/charts.js';
const options = { title: 'A < B', subtitle: 'Percentual', xLabels: ['S1', 'S2'], series: [
  { label: 'Turma A', values: [100, 70], highlight: true }, { label: 'Turma B', values: [80, 60] },
] };
test('line charts label their series and focus without a legend or background', () => {
  const chart = lineChart(options);
  assert.match(chart, /<title[^>]*>A &lt; B<\/title>/);
  assert.match(chart, /#2e8b57/);
  assert.match(chart, /#9aa0a6/);
  assert.match(chart, /<text[^>]*>Turma A<\/text>/);
  assert.match(chart, /<text[^>]*>Turma B<\/text>/);
  assert.doesNotMatch(chart, /<legend|stroke-dasharray|<rect/);
  assert.doesNotMatch(lineChart({ ...options, print: true }), /#2e8b57/);
});
test('stacked bars use the same full width for each nonempty offering', () => {
  const chart = patternBars({ title: 'Padrões', subtitle: 'Distribuição', rows: [
    { label: 'A', counts: { regular: 2, queda: 3 } },
    { label: 'B', counts: { regular: 8, queda: 1, irregular: 1 } },
  ] });
  const widths = [...chart.matchAll(/<rect[^>]+width="([\d.]+)"/g)].map(match => Number(match[1]));
  assert.equal(widths.length, 5);
  assert.ok(Math.abs(widths[0] + widths[1] - widths[2] - widths[3] - widths[4]) < 0.001);
});
