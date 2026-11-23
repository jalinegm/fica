import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildClass, parseLog, parseCompletion, PATTERNS, summarizeClass, weeklySeries, titleCompare, titlePatterns } from '../src/core.js';
import { lineChart, patternBars } from '../src/charts.js';

const usage = 'Uso: node tcc/gerar.mjs --turma "2026/1" --log arquivo.csv [--conclusao arquivo.csv] --out pasta [--limite 14]';

function optionsFrom(args) {
  const options = { groups: [], limit: 14 };
  let current;
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = args.slice(i, i + 2);
    if (!value || value.startsWith('--')) throw new Error(usage);
    if (flag === '--turma') {
      current = { name: value.trim() };
      options.groups.push(current);
    } else if (flag === '--log' && current) current.log = value;
    else if (flag === '--conclusao' && current) current.completion = value;
    else if (flag === '--out') options.out = value;
    else if (flag === '--limite') options.limit = Number(value);
    else throw new Error(usage);
  }
  if (!options.out || !options.groups.length || options.groups.some(group => !group.name || !group.log) ||
    ![7, 14, 21].includes(options.limit)) throw new Error(usage);
  return options;
}

function fileKey(name) {
  return name.replace(/[^\p{L}\p{N}_-]+/gu, '-');
}

function tccCSV(rows) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    const field = typeof value === 'number' ? String(value).replace('.', ',') : String(value ?? '');
    return /[";\r\n]/.test(field) ? '"' + field.replaceAll('"', '""') + '"' : field;
  }).join(';')).join('\r\n') + '\r\n';
}

export function runTcc(args) {
  const options = optionsFrom(args);
  const keys = options.groups.map(group => fileKey(group.name).toLowerCase());
  if (new Set(keys).size !== keys.length) throw new Error('Use nomes de turma distintos para cada oferta.');
  const classes = options.groups.map(({ name, log, completion }) => buildClass({
    name, log: parseLog(readFileSync(log, 'utf8')),
    completion: completion ? parseCompletion(readFileSync(completion, 'utf8')) : null,
    absenceLimit: options.limit,
  }));
  mkdirSync(options.out, { recursive: true });
  const save = (name, content) => writeFileSync(join(options.out, name), content);
  for (const c of classes) {
    const rows = c.students.map(row => [row.code, row.accesses, row.daysActive, row.weeksActive, c.weeks,
      row.longestAbsence, row.daysSinceLast, row.gaps7, row.gaps14, row.gaps21, row.firstHalfWeeks,
      row.secondHalfWeeks, row.completed, row.completionTotal, row.pattern]);
    save('indicadores_' + fileKey(c.name) + '.csv', tccCSV([['Código', 'Acessos', 'Dias com acesso',
      'Semanas com acesso', 'Total de semanas', 'Maior ausência (dias)', 'Dias desde o último acesso',
      'Ausências 7+', 'Ausências 14+', 'Ausências 21+', 'Semanas com acesso na primeira metade',
      'Semanas com acesso na segunda metade', 'Atividades concluídas', 'Total de atividades', 'Padrão'], ...rows]));
  }
  const summaries = classes.map(summarizeClass);
  const entries = classes.map(c => ({ name: c.name, series: weeklySeries(c) }));
  save('resumo_turmas.csv', tccCSV([['Turma', 'Estudantes', 'Equipe excluída', 'Início', 'Fim', 'Semanas',
    'Mediana de semanas com acesso', 'Média de semanas com acesso', 'Mediana de dias com acesso',
    'Mediana da maior ausência (dias)', ...PATTERNS.flatMap(({ label }) => [label + ' (n)', label + ' (%)']),
    'Estudantes com ausência 7+', 'Estudantes com ausência 14+', 'Estudantes com ausência 21+', 'Mediana da conclusão (%)'],
  ...summaries.map(s => [s.name, s.n, s.staffCount, s.start, s.end, s.weeks, s.medianWeeksActive, s.meanWeeksActive,
    s.medianDaysActive, s.medianLongestAbsence, ...PATTERNS.flatMap(({ id }) => [s.patternCounts[id], s.patternPct[id]]),
    s.studentsWithGap7, s.studentsWithGap14, s.studentsWithGap21, s.medianCompletionPct])]));
  save('semanal.csv', tccCSV([['Turma', 'Semana', 'Estudantes com acesso', 'Percentual com acesso'],
    ...entries.flatMap(({ name, series }) => series.map(row => [name, row.week, row.n, row.pct]))]));
  const periods = summaries.map(s => s.start + ' a ' + s.end).join(' · ');
  save('fig_semanal.svg', lineChart({ title: titleCompare(entries), subtitle: 'Estudantes com acesso por semana (%) · ' + periods,
    series: entries.map(({ name, series }, i) => ({ label: name, values: series.map(row => row.pct), highlight: i === entries.length - 1 })),
    xLabels: Array.from({ length: Math.max(...classes.map(c => c.weeks)) }, (_, i) => 'S' + (i + 1)), print: true }));
  save('fig_padroes.svg', patternBars({ title: titlePatterns(summaries.at(-1)), subtitle: 'Distribuição de padrões por oferta · ' + periods,
    rows: summaries.map(s => ({ label: s.name, counts: s.patternCounts })), print: true }));
  return summaries.map(s => s.name + ' · ' + s.n + ' estudantes · ' + s.start + ' a ' + s.end + ' · ' +
    PATTERNS.map(({ label, id }) => label + ': ' + s.patternCounts[id]).join(', ')).join('\n');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    console.log(runTcc(process.argv.slice(2)));
  } catch (error) {
    console.error(error.name === 'FormatError' || !error.code ? error.message : 'Falha ao ler ou gravar arquivos. Confira os caminhos e as permissões.');
    process.exitCode = 1;
  }
}
