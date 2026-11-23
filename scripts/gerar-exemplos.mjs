import { mkdirSync, writeFileSync } from 'node:fs';
import { DEMO_OFFERINGS, generateDemo } from '../src/demo.js';

const output = new URL('../exemplos/', import.meta.url);
mkdirSync(output, { recursive: true });
for (const offering of DEMO_OFFERINGS) {
  const { logText, completionText } = generateDemo(offering);
  const fileName = offering.turma.replace('/', '-') + '.csv';
  writeFileSync(new URL('log_exemplo_' + fileName, output), logText);
  if (offering.turma === '2026/1') writeFileSync(new URL('conclusao_exemplo_' + fileName, output), completionText);
}
