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
