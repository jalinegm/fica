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

test('direct labels stay separated and follow endpoint order within the plot', () => {
  const height = 236;
  const width = 1000;
  const series = [['B', 0], ['C', 100], ['D', 0.1], ['A', 99], ['E', 0]]
    .map(([label, end]) => ({ label, values: [50, end] }));
  const chart = lineChart({ ...options, series, width, height });
  const matches = [...chart.matchAll(/<text x="[\d.]+" y="([\d.-]+)"[^>]*>([A-E])<\/text>/g)];
  const labels = matches.map(([, y, label]) => ({ y: Number(y), label })).sort((a, b) => a.y - b.y);
  assert.deepEqual(labels.map(({ label }) => label), ['C', 'A', 'D', 'B', 'E']);
  assert.ok(labels[0].y >= 24);
  assert.ok(labels.at(-1).y <= height - 24);
  for (let i = 1; i < labels.length; i++) assert.ok(labels[i].y - labels[i - 1].y >= 14);
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
