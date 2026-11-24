import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildPage } from '../build.mjs';
import { addClass } from '../src/ui.js';

test('the offline page ships exactly the hashes for its embedded blocks', () => {
  buildPage();
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const digest = value => createHash('sha256').update(value).digest('base64');
  const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
  const style = page.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert.ok(page.includes(`default-src 'none'; script-src 'sha256-${digest(script)}'; style-src 'sha256-${digest(style)}'; img-src data:; font-src data:; media-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'`));
  assert.doesNotMatch(page, /\bstyle=("|')|\bsrc="https?:/);
  assert.doesNotMatch(page.replace(/<section id="moodle-help"[\s\S]*?<\/section>/, ''), /\bhref="https?:/);
  for (const label of ['Quem precisa de contato', 'Diário semanal', 'Comparar turmas',
    'Conclusão de atividades', 'Os arquivos são lidos só no seu computador']) assert.ok(page.includes(label));
});

test('repeated offer names replace the class and become active', () => {
  const original = { name: 'MSI 2026/1' };
  const edited = { name: ' msi 2026/1 ', weeks: 4 };
  const first = addClass({ classes: [], activeIndex: -1 }, original);
  const second = addClass(first.state, edited);
  assert.equal(first.replaced, false);
  assert.equal(second.replaced, true);
  assert.deepEqual(second.state.classes, [edited]);
  assert.equal(second.state.activeIndex, 0);
});

test('reloading the same log under a different name replaces its offer', () => {
  const log = { course: 'Exemplo', events: [{ time: new Date(2026, 2, 2), user: 'Ana Exemplo', origin: 'web' }] };
  const first = addClass({ classes: [] }, { name: 'A', log });
  const second = addClass(first.state, { name: 'B', log: structuredClone(log) });
  assert.equal(second.replaced, true);
  assert.equal(second.state.classes.length, 1);
});
