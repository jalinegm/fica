import { mkdirSync, writeFileSync } from 'node:fs';
import { generateDemo } from '../src/demo.js';

const output = new URL('../exemplos/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const [year, start, students] of [[2025, '2025-03-03', 36], [2026, '2026-03-02', 40]]) {
  const { logText, completionText } = generateDemo({ seed: year, turma: year + '/1', start, weeks: 18, students });
  writeFileSync(new URL('log_exemplo_' + year + '-1.csv', output), logText);
  if (year === 2026) writeFileSync(new URL('conclusao_exemplo_2026-1.csv', output), completionText);
}
