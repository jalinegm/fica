import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateDemo } from '../src/demo.js';
import { parseLog } from '../src/core.js';
import { runTcc } from '../tcc/gerar.mjs';

test('TCC output uses the same calculations and contains codes instead of names', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fica-sintetico-'));
  try {
    const args = [];
    const names = new Set();
    for (const [year, start] of [[2025, '2025-03-03'], [2026, '2026-03-02']]) {
      const demo = generateDemo({ seed: year, turma: year + '/1', start, weeks: 18, students: 20 });
      const log = join(dir, year + '.csv');
      const completion = join(dir, year + '-completion.csv');
      writeFileSync(log, demo.logText);
      writeFileSync(completion, demo.completionText);
      for (const event of parseLog(demo.logText).events) names.add(event.user);
      args.push('--turma', year + '/1', '--log', log, '--conclusao', completion);
    }
    const output = join(dir, 'saida');
    args.push('--out', output);
    let terminal;
    try {
      terminal = execFileSync(process.execPath, ['tcc/gerar.mjs', ...args], { encoding: 'utf8' });
    } catch (error) {
      if (error.code !== 'EPERM') throw error;
      terminal = runTcc(args);
    }
    assert.deepEqual(readdirSync(output).sort(), ['fig_padroes.svg', 'fig_semanal.svg',
      'indicadores_2025-1.csv', 'indicadores_2026-1.csv', 'resumo_turmas.csv', 'semanal.csv']);
    for (const file of readdirSync(output)) {
      const contents = readFileSync(join(output, file), 'utf8');
      for (const name of names) assert.ok(!contents.includes(name), file);
    }
    for (const name of names) assert.ok(!terminal.includes(name));
    assert.match(readFileSync(join(output, 'indicadores_2026-1.csv'), 'utf8'), /^E01;/m);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
