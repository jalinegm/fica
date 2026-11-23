import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildClass, parseLog, parseCompletion } from '../src/core.js';
import { generateDemo } from '../src/demo.js';
import { toCSV } from '../src/ui.js';

test('the browser CSV includes full names, a BOM and 14 columns without student codes', () => {
  const demo = generateDemo({ seed: 2026, turma: '2026/1', start: '2026-03-02', weeks: 18, students: 40 });
  const c = buildClass({ name: 'Teste', log: parseLog(demo.logText), completion: parseCompletion(demo.completionText) });
  const csv = toCSV(c);
  assert.ok(csv.startsWith('\uFEFFEstudante;'));
  for (const student of c.students) assert.ok(csv.includes(student.name + ';'));
  assert.doesNotMatch(csv, /\bE\d{2,}\b/);
  assert.equal(csv.split('\r\n')[0].split(';').length, 14);
});

test('the built classic script renders all demo tabs and prepares a named print report', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map();
  const listeners = {};
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', focus() {} });
      return nodes.get(selector);
    },
    addEventListener(name, listener) { listeners[name] = listener; },
  };
  const window = {
    addEventListener(name, listener) { listeners[name] = listener; },
    print() { listeners.beforeprint(); },
  };
  const localStorage = { getItem: () => '21' };
  runInNewContext(script, { document, window, localStorage });
  assert.match(nodes.get('main').innerHTML, /Log do curso \(obrigatório\)/);
  const click = dataset => listeners.click({ target: { closest: () => ({ dataset }) } });
  click({ action: 'demo' });
  assert.match(nodes.get('main').innerHTML, /Dados fictícios de demonstração/);
  assert.match(nodes.get('main').innerHTML, /value="21" selected/);
  for (const [tab, pattern] of [['diary', /Matriz de acesso semanal/], ['compare', /Indicadores por turma/],
    ['completion', /Conclusão por atividade/], ['triage', /Copiar lista/]]) {
    click({ tab });
    assert.match(nodes.get('main').innerHTML, pattern);
    assert.match(nodes.get('main').innerHTML, /role="tabpanel"/);
  }
  click({ action: 'print' });
  const printed = nodes.get('#print-report').innerHTML;
  assert.match(printed, /Data de referência/);
  assert.match(printed, /<svg/);
  assert.match(printed, /Ana Ribeiro/);
  assert.doesNotMatch(printed, /Copiar lista|\bE\d{2,}\b/);
});
