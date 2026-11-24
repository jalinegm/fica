import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildClass, parseLog, parseCompletion } from '../src/core.js';
import { DEMO_OFFERINGS, generateDemo } from '../src/demo.js';
import { displayName, spreadsheet, referenceNote, triageGroups } from '../src/ui.js';

test('the spreadsheet keeps original full names, numeric indicators and an about sheet', () => {
  const demo = generateDemo({ seed: 2026, turma: '2026/1', start: '2026-03-02', weeks: 18, students: 40 });
  const c = buildClass({ name: 'Teste', log: parseLog(demo.logText), completion: parseCompletion(demo.completionText) });
  const [students, about] = spreadsheet(c);
  assert.equal(students.rows[0][0], 'Estudante');
  assert.equal(students.rows.length, c.students.length + 1);
  assert.deepEqual(students.rows.slice(1).map(row => row[0]), c.students.map(row => row.name));
  assert.ok(students.rows.slice(1).every(row => typeof row[1] === 'number'));
  assert.doesNotMatch(JSON.stringify(students.rows), /\bE\d{2,}\b/);
  assert.equal(about.name, 'Sobre');
  assert.match(referenceNote(c), /^dias contados até \d{2}\/\d{2}\/\d{4} \((fim da disciplina|último registro do log)\)$/);
});

test('the built classic script renders all demo tabs and prepares a named print report', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const nodes = new Map();
  const listeners = {};
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, { innerHTML: '', textContent: '', focus() {},
        replaceWith(form) { nodes.set(selector, form); } });
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
    if (tab !== 'triage') {
      const widths = [...nodes.get('main').innerHTML.matchAll(/viewBox="0 0 (\d+) \d+"/g)];
      assert.equal(widths.length, tab === 'diary' ? 1 : 2);
      assert.ok(widths.every(([, width]) => width === '1000'));
    }
  }
  click({ action: 'upload' });
  assert.match(nodes.get('main').innerHTML, /Voltar à análise/);
  const originalForm = document.querySelector('main form');
  originalForm.selectedFile = 'CSV fictício';
  click({ action: 'help' });
  nodes.delete('main form');
  click({ action: 'back' });
  assert.equal(document.querySelector('main form'), originalForm);
  assert.equal(originalForm.selectedFile, 'CSV fictício');
  click({ action: 'return-analysis' });
  assert.match(nodes.get('main').innerHTML, /Copiar lista/);
  listeners.change({ target: { id: 'active-class', value: '0' } });
  assert.match(nodes.get('main').innerHTML, /Ver todos/);
  click({ action: 'print' });
  const printed = nodes.get('#print-report').innerHTML;
  const className = 'MSI 2025/1 (dados fictícios)';
  assert.ok(printed.includes(`<h1>${className}</h1>`));
  assert.match(printed, /dias contados até \d{2}\/\d{2}\/\d{4}/);
  assert.match(printed, /Dados fictícios de demonstração/);
  assert.match(printed, /<svg[^>]*viewBox="0 0 1000 /);
  const demo = generateDemo(DEMO_OFFERINGS[0]);
  const c = buildClass({ name: className, log: parseLog(demo.logText),
    completion: parseCompletion(demo.completionText), absenceLimit: 21 });
  const [largest] = triageGroups(c);
  assert.ok(largest.students.length > 8);
  const urgent = printed.match(/<section class="zone urgent"[\s\S]*?(?=<section class="zone watch")/)[0];
  for (const { name } of largest.students) assert.ok(urgent.includes(`>${displayName(name)}</span>`), name);
  const regular = printed.match(/<section class="regular-list">([\s\S]*?)<\/section>/)[1];
  const regularNames = c.students.filter(row => row.pattern === 'regular').map(row => displayName(row.name));
  assert.deepEqual([...regular.matchAll(/<li><span class="who">([^<]+)<\/span><\/li>/g)].map(([, name]) => name), regularNames);
  assert.doesNotMatch(regular, /class="why"/);
  const footer = printed.match(/<footer class="print-footer">([\s\S]*?)<\/footer>/)[1];
  assert.ok(footer.includes(`${className} · FICA · Gerado em`));
  assert.match(footer, /Gerado em \d{1,2}\/\d{1,2}\/\d{4}/);
  assert.ok(footer.includes('© Profa. Jaline Mombach · jaline.mombach@iffarroupilha.edu.br'));
  assert.match(page, /@bottom-right\s*\{\s*content: "página " counter\(page\) " de " counter\(pages\)/);
  assert.doesNotMatch(printed, /Acesso ao Moodle não é o mesmo que participação ou aprendizagem|class="reminder"|Ver todos|Copiar lista|\bE\d{2,}\b/);
});
