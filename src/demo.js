const demoFirstNames = ['Ana', 'Beatriz', 'Caio', 'Daniela', 'Elisa', 'Fábio', 'Gabriela', 'Hugo', 'Isabel', 'João',
  'Lara', 'Mateus', 'Nina', 'Olívia', 'Paulo', 'Rita', 'Samuel', 'Tainá', 'Vítor', 'Yasmin'];
const demoLastNames = ['Ribeiro', 'Alves', 'Pereira', 'Andrade', 'Martins', 'Costa', 'Rocha', 'Fernandes', 'Lima', 'Barros'];
const demoActivities = ['Apresentação no fórum', 'Questionário de informática', 'Pesquisa na web\nAtividade prática',
  'Editor de texto', 'Planilhas', 'Projeto final'];

function mulberry32(seed) {
  return () => {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function demoCSV(rows) {
  return '\uFEFF' + rows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\r\n');
}

export function generateDemo({ seed, turma, start, weeks, students }) {
  const random = mulberry32(seed);
  const dateAt = offset => new Date(Date.parse(start + 'T00:00:00Z') + offset * 86_400_000).toISOString().slice(0, 10);
  const end = weeks - 1;
  const half = Math.ceil(weeks / 2);
  const log = [['Hora', 'Nome completo', 'Usuário afetado', 'Contexto do Evento', 'Componente', 'Nome do evento', 'Descrição', 'Origem', 'endereço IP']];
  const course = 'Curso: Introdução à Informática · ' + turma + ' (dados fictícios)';
  const addEvent = (day, name, event = 'Curso visualizado', origin = 'web') => {
    const [year, month, date] = dateAt(day).split('-');
    const hour = Math.floor(8 + random() * 11);
    log.push([date + '/' + month + '/' + year.slice(2) + ', ' + String(hour).padStart(2, '0') + ':15:00',
      name, '', course, 'Sistema', event, '', origin, '0.0.0.0']);
  };
  const completion = [['', 'Endereço de email', ...demoActivities.flatMap(activity => [activity, ''])]];
  for (let i = 0; i < students; i++) {
    const first = demoFirstNames[i % demoFirstNames.length];
    const last = demoLastNames[Math.floor(i / demoFirstNames.length) % demoLastNames.length];
    const batch = Math.floor(i / (demoFirstNames.length * demoLastNames.length));
    const name = first + ' ' + last + (batch ? ' ' + (batch + 1) : '');
    const fraction = (i + 0.5) / students;
    const schedule = [];
    for (let week = 0; week < weeks; week++) {
      if (fraction < 0.55 && (week === 0 || week === end || week % 2 === 0 || random() < 0.82)) schedule.push(week);
      else if (fraction >= 0.55 && fraction < 0.67 && week < weeks - 3) schedule.push(week);
      else if (fraction >= 0.67 && fraction < 0.79 && (week < half || (end - week) % 3 === 0)) schedule.push(week);
      else if (fraction >= 0.79 && fraction < 0.87 && (week === 2 || week === end)) schedule.push(week);
      else if (fraction >= 0.87 && fraction < 0.95 && (end - week) % 2 === 0) schedule.push(week);
    }
    for (const week of schedule) {
      const day = week * 7 + 2;
      addEvent(day, name, 'Curso visualizado', random() < 0.2 ? 'ws' : 'web');
      if (random() < 0.48) addEvent(day, name, 'Módulo de curso visualizado');
      if (random() < 0.55) addEvent(day + 2, name);
    }
    if (i === 0) addEvent(weeks * 7 + 91, name);
    const chance = 0.08 + 0.85 * schedule.length / weeks;
    completion.push([name, 'estudante' + (i + 1) + '@example.invalid', ...demoActivities.flatMap(() =>
      random() < chance ? ['Concluído', dateAt(end * 7 + 6) + ' 16:00:00'] : ['Não concluído', ''])]);
  }
  addEvent(1, 'Helena Mendes', 'O envio foi avaliado.');
  addEvent(weeks * 7 - 1, 'Rafael Pinto', 'Relatório de log visto');
  addEvent(weeks * 7 - 1, 'Rafael Pinto', 'Rotina do sistema', 'cli');
  return { logText: demoCSV(log), completionText: demoCSV(completion) };
}
