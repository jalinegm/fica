export class FormatError extends Error {
  constructor(code) {
    const messages = {
      'is-completion': "Este parece ser o arquivo de conclusão de atividades. Carregue-o no campo 'Conclusão de atividades'.",
      'is-log': "Este parece ser o log. Carregue-o no campo 'Log do curso'.",
      'not-csv': "O arquivo precisa estar em CSV. No Moodle, escolha 'Valores separados por vírgula (.csv)' ao baixar.",
      'not-log': 'Não encontramos as colunas do log do Moodle (Hora, Nome completo, Nome do evento). Confira se baixou Relatórios > Logs.',
      'bad-date': 'Não conseguimos ler as datas deste log. Avise a autora da ferramenta com um exemplo de data (sem nomes).',
    };
    super(messages[code]);
    this.name = 'FormatError';
    this.code = code;
  }
}

export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"' && !field) {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\r' || char === '\n') {
      rows.push([...row, field]);
      row = [];
      field = '';
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else {
      field += char;
    }
  }
  if (quoted) throw new FormatError('not-csv');
  if (row.length || field || text.endsWith('"')) rows.push([...row, field]);
  return rows;
}

const monthNames = 'January February March April May June July August September October November December'.toLowerCase().split(' ');

export function parseMoodleDate(input) {
  const value = input.trim();
  const pt = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  const en = /^(\d{1,2})\s+([a-z]+)\s+(\d{4}),\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(value);
  if (!pt && !en) return null;
  const [, dayText, monthText, yearText, hourText, minuteText, secondText = '0', meridiem] = pt || en;
  const day = Number(dayText);
  const month = pt ? Number(monthText) - 1 : monthNames.indexOf(monthText.toLowerCase());
  const year = Number(yearText) + (yearText.length === 2 ? 2000 : 0);
  let hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (en) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
  }
  if (month < 0 || month > 11 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(hour, minute, second, 0);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
}

const logHeaders = {
  pt: ['hora', 'nome completo', 'nome do evento', 'componente', 'origem', 'contexto do evento'],
  en: ['time', 'user full name', 'event name', 'component', 'origin', 'event context'],
};

function reportRows(text) {
  if (!text.trim() || /^(?:\uFEFF)?PK\x03\x04/.test(text) || text.includes('\0')) {
    throw new FormatError('not-csv');
  }
  return parseCSV(text).filter(row => row.some(field => field.trim()));
}

function isCompletionHeader(header) {
  return header[0] === '' && ['endereço de email', 'email address'].includes(header[1]);
}

export function parseLog(text) {
  const [first = [], ...rows] = reportRows(text);
  const header = first.map(value => value.trim().toLowerCase());
  if (isCompletionHeader(header)) throw new FormatError('is-completion');
  const language = Object.keys(logHeaders).find(key => logHeaders[key].every(name => header.includes(name)));
  if (!language) throw new FormatError('not-log');
  const [timeIndex, userIndex, eventIndex, componentIndex, originIndex, contextIndex] =
    logHeaders[language].map(name => header.indexOf(name));
  const events = [];
  const contexts = new Map();
  const courseContexts = new Map();
  for (const row of rows) {
    const time = parseMoodleDate(row[timeIndex] ?? '');
    if (!time) continue;
    const context = row[contextIndex]?.trim() ?? '';
    const course = /^(?:Curso|Course):\s*(.+)$/i.exec(context)?.[1].trim();
    if (course) courseContexts.set(course, (courseContexts.get(course) ?? 0) + 1);
    if (context) contexts.set(context, (contexts.get(context) ?? 0) + 1);
    events.push({
      time,
      user: row[userIndex]?.trim() ?? '',
      event: row[eventIndex]?.trim() ?? '',
      component: row[componentIndex]?.trim() ?? '',
      origin: row[originIndex]?.trim().toLowerCase() ?? '',
    });
  }
  if (!events.length) throw new FormatError('bad-date');
  const choices = courseContexts.size ? courseContexts : contexts;
  const course = [...choices].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return { course, language, events };
}

export function parseCompletion(text) {
  const [first = [], ...rows] = reportRows(text);
  const header = first.map(value => value.trim().toLowerCase());
  if (Object.values(logHeaders).some(names => names.slice(0, 3).every(name => header.includes(name)))) {
    throw new FormatError('is-log');
  }
  if (!isCompletionHeader(header) || (header.length - 2) % 2 !== 0) {
    throw new FormatError('not-csv');
  }
  const activities = first.slice(2).filter((_, i) => i % 2 === 0).map(collapseSpaces);
  const students = rows.filter(row => row[0]?.trim()).map(row => ({
    name: row[0].trim(),
    email: row[1]?.trim() ?? '',
    done: activities.map((_, i) => ['Concluído', 'Completed'].includes(row[2 + i * 2]?.trim())),
  }));
  return { activities, students };
}

function collapseSpaces(value) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeName(value) {
  return collapseSpaces(value).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export const STAFF_EVENTS = [
  'O envio foi avaliado.', 'Módulo de curso atualizado', 'Módulo do curso criado',
  'Item de nota atualizado', 'Relatório de log visto', 'Formulário de notas visualizado',
  'Seção do curso atualizada', 'Submission graded.', 'Course module updated',
  'Course module created', 'Grade item updated', 'Log report viewed',
];

function isAccess(event) {
  return event.origin === 'web' || event.origin === 'ws';
}

export function identifyPeople(events, completion, overrides = {}) {
  const names = new Map();
  const enrolled = new Set();
  const staff = new Set();
  const access = new Set();
  for (const { name } of completion?.students ?? []) {
    const key = normalizeName(name);
    if (!key || names.has(key)) continue;
    names.set(key, name);
    enrolled.add(key);
  }
  for (const event of events) {
    const key = normalizeName(event.user);
    if (!key) continue;
    if (!names.has(key)) names.set(key, event.user);
    if (STAFF_EVENTS.includes(event.event)) staff.add(key);
    if (isAccess(event)) access.add(key);
  }
  const staffOverrides = new Set((overrides.staff ?? []).map(normalizeName));
  const studentOverrides = new Set((overrides.students ?? []).map(normalizeName));
  const result = { students: [], staff: [], source: completion ? 'completion' : 'heuristic' };
  for (const [key, name] of names) {
    if (staffOverrides.has(key)) result.staff.push(name);
    else if (studentOverrides.has(key)) result.students.push(name);
    else if (completion ? enrolled.has(key) : access.has(key) && !staff.has(key)) result.students.push(name);
    else if (completion || staff.has(key)) result.staff.push(name);
  }
  return result;
}

export function assignCodes(names) {
  const width = Math.max(2, String(names.length).length);
  return new Map([...names]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    .map((name, index) => [name, 'E' + String(index + 1).padStart(width, '0')]));
}

const dayMs = 86_400_000;

export function dayKey(date) {
  return [String(date.getFullYear()).padStart(4, '0'), date.getMonth() + 1, date.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-');
}

function calendarTime(day) {
  return Date.parse(day + 'T00:00:00Z');
}

export function daysBetween(a, b) {
  return (calendarTime(b) - calendarTime(a)) / dayMs;
}

export function shiftDay(day, offset) {
  return new Date(calendarTime(day) + offset * dayMs).toISOString().slice(0, 10);
}

function weekStart(day) {
  const weekday = new Date(calendarTime(day)).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}

export function proposePeriod(events, students) {
  const enrolled = new Set(students.map(normalizeName));
  const weeks = new Map();
  let earliest = null;
  for (const event of events) {
    const day = dayKey(event.time);
    if (earliest === null || day < earliest) earliest = day;
    const key = normalizeName(event.user);
    if (!isAccess(event) || !enrolled.has(key)) continue;
    const monday = weekStart(day);
    if (!weeks.has(monday)) weeks.set(monday, new Set());
    weeks.get(monday).add(key);
  }
  const active = [...weeks.keys()].sort();
  const continuous = active.filter(week => weeks.get(week).size >= 0.2 * enrolled.size);
  const selected = continuous.length ? continuous : active;
  const start = selected[0] ?? weekStart(earliest ?? dayKey(new Date()));
  return { start, end: shiftDay(selected.at(-1) ?? start, 6) };
}

export function buildClass({ name, log, completion = null, period = null, overrides = {}, absenceLimit = 14 }) {
  const people = identifyPeople(log.events, completion, overrides);
  period ??= proposePeriod(log.events, people.students);
  const { start, end } = period;
  const firstMonday = weekStart(start);
  const weeks = 1 + Math.floor(daysBetween(firstMonday, end) / 7);
  const lastLogDay = log.events.reduce((last, { time }) => {
    const day = dayKey(time);
    return day > last ? day : last;
  }, '');
  const refDate = lastLogDay && lastLogDay < end ? lastLogDay : end;
  const byStudent = new Map(people.students.map(name => [normalizeName(name), []]));
  for (const event of log.events) {
    if (!isAccess(event)) continue;
    const day = dayKey(event.time);
    if (day >= start && day <= refDate) byStudent.get(normalizeName(event.user))?.push(day);
  }
  const completedByName = new Map(completion?.students.map(row => [normalizeName(row.name), row.done]));
  const activities = completion?.activities ?? [];
  const students = [...assignCodes(people.students)].map(([name, code]) => {
    const accesses = byStudent.get(normalizeName(name));
    const activeDays = [...new Set(accesses)].sort();
    const weeklyDays = Array(weeks).fill(0);
    for (const day of activeDays) weeklyDays[Math.floor(daysBetween(firstMonday, day) / 7)]++;
    const half = Math.ceil(weeks / 2);
    const firstHalfWeeks = weeklyDays.slice(0, half).filter(Boolean).length;
    const secondHalfWeeks = weeklyDays.slice(half).filter(Boolean).length;
    const daysSinceLast = activeDays.length ? daysBetween(activeDays.at(-1), refDate) : null;
    const absences = activeDays.length
      ? [daysBetween(start, activeDays[0]), daysSinceLast,
        ...activeDays.slice(1).map((day, i) => daysBetween(activeDays[i], day) - 1)]
      : [Math.max(0, daysBetween(start, refDate) + 1)];
    const done = completedByName.get(normalizeName(name));
    const row = {
      name, code, accesses: accesses.length, daysActive: activeDays.length,
      weeksActive: firstHalfWeeks + secondHalfWeeks, weeklyDays, activeDays, firstHalfWeeks, secondHalfWeeks,
      longestAbsence: absences.reduce((max, days) => Math.max(max, days), 0), daysSinceLast,
      gaps7: absences.filter(days => days >= 7).length,
      gaps14: absences.filter(days => days >= 14).length,
      gaps21: absences.filter(days => days >= 21).length,
      completed: done ? done.filter(Boolean).length : null,
      completionTotal: done ? activities.length : null, done: done ?? null,
    };
    row.pattern = !completion && !row.accesses ? 'irregular' : classifyPattern(row, weeks, absenceLimit);
    return row;
  });
  return {
    name, period, weeks, refDate, students, staff: people.staff, source: people.source,
    hasCompletion: Boolean(completion), activities, absenceLimit,
    warnings: completion ? [] : ['Estudantes que nunca acessaram não aparecem. Carregue a conclusão de atividades para incluí-los.'],
  };
}

export const PATTERNS = [
  { id: 'sem-acesso', label: 'Sem acesso', tone: 'red', strategy: 'Contato individual para entender possíveis dificuldades' },
  { id: 'afastamento', label: 'Afastamento', tone: 'red', strategy: 'Contato individual para entender possíveis dificuldades' },
  { id: 'queda', label: 'Queda progressiva', tone: 'amber', strategy: 'Acompanhamento individual e incentivo à retomada' },
  { id: 'concentrado', label: 'Acesso concentrado', tone: 'amber', strategy: 'Orientação sobre rotina de estudos' },
  { id: 'irregular', label: 'Irregular', tone: 'amber', strategy: 'Lembretes e orientações periódicas' },
  { id: 'regular', label: 'Regular', tone: 'green', strategy: '' },
];

export function classifyPattern(row, weeks, absenceLimit) {
  if (!row.accesses) return 'sem-acesso';
  if (row.daysSinceLast >= absenceLimit) return 'afastamento';
  if (row.firstHalfWeeks >= 3 && row.secondHalfWeeks <= 0.5 * row.firstHalfWeeks) return 'queda';
  const busiest = [...row.weeklyDays].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
  if (row.weeksActive < 0.4 * weeks && busiest > 0.5 * row.daysActive) return 'concentrado';
  if (row.weeksActive < 0.7 * weeks || row.longestAbsence >= absenceLimit) return 'irregular';
  return 'regular';
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function percent(part, total) {
  return total ? Math.round(1000 * part / total) / 10 : 0;
}

export function summarizeClass(c) {
  const n = c.students.length;
  const values = field => c.students.map(row => row[field]);
  const patternCounts = Object.fromEntries(PATTERNS.map(({ id }) => [id, 0]));
  for (const row of c.students) patternCounts[row.pattern]++;
  const patternPct = Object.fromEntries(PATTERNS.map(({ id }) => [id, percent(patternCounts[id], n)]));
  const completion = c.students.filter(row => row.completionTotal).map(row => 100 * row.completed / row.completionTotal);
  return {
    name: c.name, n, staffCount: c.staff.length, start: c.period.start, end: c.period.end, weeks: c.weeks,
    medianWeeksActive: median(values('weeksActive')), meanWeeksActive: Math.round(10 * mean(values('weeksActive'))) / 10,
    medianDaysActive: median(values('daysActive')), medianLongestAbsence: median(values('longestAbsence')),
    patternCounts, patternPct,
    studentsWithGap7: values('gaps7').filter(Boolean).length,
    studentsWithGap14: values('gaps14').filter(Boolean).length,
    studentsWithGap21: values('gaps21').filter(Boolean).length,
    medianCompletionPct: completion.length ? Number(median(completion).toFixed(1)) : null,
  };
}

export function weeklySeries(c) {
  const counts = Array(c.weeks).fill(0);
  for (const row of c.students) row.weeklyDays.forEach((days, index) => { if (days) counts[index]++; });
  return counts.map((n, index) => ({ week: index + 1, n, pct: percent(n, c.students.length) }));
}

export function sustainedDeclineWeek(series) {
  let index = series.length - 1;
  while (index >= 1 && series[index].pct < 50) index--;
  return index < series.length - 1 ? series[index + 1].week : null;
}

export function titleWeekly(series) {
  const week = sustainedDeclineWeek(series);
  if (week !== null) return `A partir da semana ${week}, menos da metade da turma acessou o curso`;
  const first = series[0]?.pct ?? 0;
  const last = series.at(-1)?.pct ?? 0;
  if (last <= first - 20) return `O acesso caiu de ${Math.round(first)}% na semana 1 para ${Math.round(last)}% na última semana`;
  if (!series.length) return 'Sem semanas de acesso para analisar';
  const majority = series.filter(row => row.pct > 50).length;
  return majority === series.length ? 'A maior parte da turma acessou o curso em todas as semanas'
    : `Em ${majority} de ${series.length} semanas, mais da metade da turma acessou o curso`;
}

export function titleCompare(entries) {
  if (entries.length < 2) return titleWeekly(entries[0]?.series ?? []);
  const finalMean = ({ series }) => mean(series.slice(Math.min(Math.ceil(series.length / 2), series.length - 1)).map(row => row.pct));
  const [leader, next] = entries.map(entry => ({ ...entry, score: finalMean(entry) })).sort((a, b) => b.score - a.score);
  if (leader.score === next.score) return 'Houve empate na maior média de acesso na parte final das ofertas';
  return `${leader.name} manteve mais estudantes acessando até o fim da oferta`;
}

export function titlePatterns(summary) {
  const [top] = PATTERNS.filter(({ id }) => id !== 'regular')
    .sort((a, b) => summary.patternCounts[b.id] - summary.patternCounts[a.id]);
  const count = summary.patternCounts[top.id];
  return count ? `${top.label} foi o padrão de atenção mais frequente (${count} de ${summary.n} estudantes)`
    : 'Todos os estudantes tiveram acesso regular';
}
