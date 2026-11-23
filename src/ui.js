import { buildClass, parseLog, parseCompletion, normalizeName, FormatError, PATTERNS, summarizeClass } from './core.js';
import { escapeMarkup } from './charts.js';
import { generateDemo } from './demo.js';

const VIDEO_AJUDA = '';
const tabs = [
  ['triage', 'Quem precisa de contato'], ['diary', 'Diário semanal'],
  ['compare', 'Comparar turmas'], ['completion', 'Conclusão de atividades'],
];
const initialState = { classes: [], activeIndex: -1, tab: 'triage', anonymize: false, absenceLimit: 14, view: 'upload' };
let currentState = initialState;

function matchingLogs(a, b) {
  return a && b && (a === b || (a.course === b.course && a.events.length === b.events.length &&
    a.events.every((event, i) => {
      const other = b.events[i];
      return +event.time === +other.time && event.user === other.user && event.origin === other.origin &&
        event.event === other.event && event.component === other.component;
    })));
}

export function addClass(state, classData) {
  const same = c => normalizeName(c.name) === normalizeName(classData.name) || matchingLogs(c.log, classData.log);
  const firstMatch = state.classes.findIndex(same);
  const classes = state.classes.filter(c => !same(c));
  const activeIndex = firstMatch === -1 ? classes.length : firstMatch;
  classes.splice(activeIndex, 0, classData);
  return { state: { ...state, classes, activeIndex }, replaced: firstMatch !== -1 };
}

const uiEscape = escapeMarkup;
const helpButton = (text = 'Como baixar os relatórios do Moodle') =>
  `<button type="button" class="link" data-action="help">${text}</button>`;
const periodLabel = ({ start, end }) => [start, end].map(day => day.split('-').reverse().join('/')).join(' a ');
const activeClass = state => state.classes[state.activeIndex];

function completeOffer(input, absenceLimit) {
  const calculated = buildClass({ ...input, absenceLimit });
  return { ...calculated, log: input.log, completion: input.completion, overrides: input.overrides, demo: input.demo };
}

function navigation(state) {
  if (!state.classes.length || state.view !== 'analysis') return '';
  const choices = state.classes.map((c, i) =>
    `<option value="${i}"${i === state.activeIndex ? ' selected' : ''}>${uiEscape(c.name)}</option>`).join('');
  return `<div class="nav-row"><div class="tabs" role="tablist" aria-label="Análises da turma">${tabs.map(([id, name]) =>
    `<button id="tab-${id}" type="button" role="tab" aria-controls="panel-${id}" aria-selected="${state.tab === id}" tabindex="${state.tab === id ? 0 : -1}" data-tab="${id}">${name}</button>`).join('')}</div>
    ${state.classes.length > 1 ? `<label class="class-select">Turma <select id="active-class">${choices}</select></label>` : ''}</div>`;
}

function uploadView() {
  const field = (id, label) => `<div class="drop field" data-drop="${id}">
    <label for="${id}">${label}</label><input type="file" id="${id}" accept=".csv,text/csv" aria-describedby="${id}-hint ${id}-error">
    <small id="${id}-hint" class="muted">Arraste o CSV ou escolha o arquivo.</small>
    <div id="${id}-error" class="error" role="alert"></div></div>`;
  return `<section class="surface narrow stack"><h1 data-view-heading tabindex="-1">Carregar arquivos</h1>
    <p>Os arquivos são lidos só no seu computador. Nada é enviado para a internet.</p>
    <form id="upload-form" class="stack">
      <div class="drop-grid">${field('log-file', 'Log do curso (obrigatório)')}${field('completion-file', 'Conclusão de atividades (opcional)')}</div>
      <div class="field"><label for="class-name">Nome da turma (opcional)</label><input id="class-name" placeholder="Ex.: Introdução à Informática · 2026/1"></div>
      <div class="actions"><button type="submit" class="primary">Analisar</button>${helpButton()}
        <button type="button" class="link" data-action="demo">Ver exemplo com dados fictícios</button></div>
    </form></section>`;
}

function reviewView(c) {
  const participants = [
    ...c.students.map(({ name, code }) => ({ name, label: currentState.anonymize ? code : name, staff: false })),
    ...c.staff.map((name, index) => ({ name, label: currentState.anonymize ? 'Equipe ' + (index + 1) : name, staff: true })),
  ];
  return `<section class="surface narrow stack"><h1 data-view-heading tabindex="-1">Conferir turma</h1>
    <p>${c.students.length} estudantes · ${c.staff.length} pessoas da equipe</p>
    ${c.warnings.map(warning => `<p class="muted">${warning}</p>`).join('')}
    <form id="review-form" class="stack"><div class="field"><label for="review-name">Nome da turma</label>
      <input id="review-name" value="${uiEscape(c.name)}" required></div>
      <div class="field-grid"><div class="field"><label for="review-start">Início</label><input type="date" id="review-start" value="${c.period.start}" required></div>
      <div class="field"><label for="review-end">Fim</label><input type="date" id="review-end" value="${c.period.end}" required></div></div>
      <details><summary>Revisar quem é equipe</summary><div class="people">${participants.map(({ label, staff }, i) =>
        `<label><input type="checkbox" data-person="${i}"${staff ? ' checked' : ''}>${uiEscape(label)}</label>`).join('')}</div></details>
      <p id="review-error" class="error" role="alert"></p>
      <div class="actions"><button type="submit" class="primary">Ver análise</button><button type="button" data-action="upload">Voltar ao carregamento</button></div>
    </form></section>`;
}

function helpView() {
  let video = '';
  if (/^https:\/\//i.test(VIDEO_AJUDA)) video = `<p><a href="${uiEscape(VIDEO_AJUDA)}" target="_blank" rel="noopener noreferrer">Assistir ao vídeo</a></p>`;
  else if (/^(?!\/)[\w/.\-]+\.mp4$/i.test(VIDEO_AJUDA)) video = `<video controls preload="none" src="${uiEscape(VIDEO_AJUDA)}">Vídeo de exportação dos relatórios do Moodle.</video>`;
  return `<section id="moodle-help" class="surface narrow stack help"><h1 data-view-heading tabindex="-1">Como baixar os relatórios do Moodle</h1>
    <div><h2>Log do curso</h2><ol><li>Abra o curso e vá a <strong>Relatórios → Logs</strong>.</li>
      <li>Deixe selecionados todos os participantes, dias, atividades e demais filtros.</li>
      <li>Selecione <strong>Obter estes logs</strong>.</li>
      <li>Escolha <strong>Valores separados por vírgula (.csv)</strong> e baixe o arquivo.</li></ol></div>
    <div><h2>Conclusão de atividades</h2><ol><li>No curso, acesse <strong>Relatórios → Conclusão de atividades</strong>.</li>
      <li>Baixe o relatório em <strong>CSV</strong> e carregue-o no campo opcional da mesma turma.</li></ol></div>
    ${video}
    <div class="stack"><h2>Perguntas frequentes</h2>
      <details><summary>Por que alguns estudantes não aparecem?</summary><p>O log só registra quem fez algo no curso. Use a conclusão de atividades para incluir toda a turma.</p></details>
      <details><summary>Como os padrões são definidos?</summary><p>Os padrões usam dias de ausência e distribuição das semanas com acesso. São sinais para orientar o acompanhamento.</p></details>
      <details><summary>Meus dados saem do computador?</summary><p>Os relatórios são processados no seu navegador. Você escolhe onde guardar os CSVs e PDFs que exportar.</p></details>
    </div><div class="actions"><button type="button" data-action="back">Voltar</button></div></section>`;
}

function analysisView(state, c) {
  if (state.tab === 'triage') return triageView(state, c);
  const label = tabs.find(([id]) => state.tab === id)[1];
  return `<section class="surface"><h1 data-view-heading tabindex="-1">${label}</h1><p>${c.students.length} estudantes · ${periodLabel(c.period)}</p></section>`;
}

export function render(state) {
  currentState = state;
  const c = activeClass(state);
  document.querySelector('#top-class').textContent = c?.name ?? '';
  document.querySelector('#navigation').innerHTML = navigation(state);
  const main = document.querySelector('main');
  if (state.view === 'help') main.innerHTML = helpView();
  else if (state.view === 'review') main.innerHTML = reviewView(state.draft);
  else if (state.view === 'analysis' && c) {
    main.innerHTML = (c.demo ? '<p class="demo-band">Dados fictícios de demonstração</p>' : '') +
      `<section role="tabpanel" id="panel-${state.tab}" aria-labelledby="tab-${state.tab}">${analysisView(state, c)}</section>` +
      tabs.filter(([id]) => id !== state.tab).map(([id]) =>
        `<section role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" hidden></section>`).join('');
  } else main.innerHTML = uploadView();
}

function update(next, focus) {
  render({ ...currentState, ...next });
  if (focus) document.querySelector(focus)?.focus();
}

function notice(message) {
  const el = document.querySelector('#notice');
  el.textContent = message;
  el.hidden = !message;
}

function changeView(view, extra = {}) {
  notice('');
  update({ view, ...extra }, '[data-view-heading]');
}

function fileError(input, message) {
  input.toggleAttribute('aria-invalid', Boolean(message));
  if (message) input.setAttribute('aria-invalid', 'true');
  document.getElementById(input.id + '-error').innerHTML = message ? uiEscape(message) + ' ' + helpButton('Ver ajuda') : '';
}

async function fromFile(input, parse) {
  const file = input.files[0];
  if (!file) {
    if (input.id === 'log-file') throw new Error('Escolha o CSV de logs do curso.');
    return null;
  }
  if (/\.(xlsx?|ods|zip)$/i.test(file.name)) throw new FormatError('not-csv');
  return parse(await file.text());
}

async function submitUpload(form) {
  const logInput = form.querySelector('#log-file');
  const completionInput = form.querySelector('#completion-file');
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  const results = await Promise.allSettled([fromFile(logInput, parseLog), fromFile(completionInput, parseCompletion)]);
  if (!form.isConnected) return;
  button.disabled = false;
  const errorMessages = ['Não foi possível ler o log do curso. Confira Relatórios → Logs.',
    'Não foi possível ler a conclusão. Baixe o CSV em Relatórios → Conclusão de atividades.'];
  const inputs = [logInput, completionInput];
  for (const [i, result] of results.entries()) {
    let message = result.status === 'rejected' ? result.reason instanceof FormatError || !inputs[i].files.length
      ? result.reason.message : errorMessages[i] : '';
    if (i === 1 && result.reason?.code === 'not-csv') message += ' Baixe o CSV em Relatórios → Conclusão de atividades.';
    fileError(inputs[i], message);
  }
  const firstError = results.findIndex(result => result.status === 'rejected');
  if (firstError !== -1) {
    inputs[firstError].focus();
    return;
  }
  const [log, completion] = results.map(result => result.value);
  if (completion) completion.students = completion.students.map(({ name, done }) => ({ name, done }));
  const name = form.querySelector('#class-name').value.trim() || log.course || 'Turma';
  const draft = completeOffer({ name, log, completion }, currentState.absenceLimit);
  changeView('review', { draft });
}

function submitReview(form) {
  const draft = currentState.draft;
  const name = form.querySelector('#review-name').value.trim();
  const start = form.querySelector('#review-start').value;
  const end = form.querySelector('#review-end').value;
  const error = form.querySelector('#review-error');
  if (!name || end < start) {
    error.textContent = name ? 'A data final precisa ser igual ou posterior à inicial.' : 'Informe o nome da turma.';
    form.querySelector(name ? '#review-end' : '#review-name').focus();
    return;
  }
  const names = [...draft.students.map(row => row.name), ...draft.staff];
  const overrides = { staff: [], students: [] };
  for (const input of form.querySelectorAll('[data-person]')) {
    overrides[input.checked ? 'staff' : 'students'].push(names[Number(input.dataset.person)]);
  }
  const c = completeOffer({ ...draft, name, period: { start, end }, overrides }, currentState.absenceLimit);
  const { state, replaced } = addClass(currentState, c);
  changeView('analysis', { ...state, view: 'analysis', tab: 'triage', draft: null });
  if (replaced) notice('A turma que já estava aberta foi substituída.');
}

function showDemo() {
  let state = currentState;
  for (const [seed, start, students] of [[2025, '2025-03-03', 36], [2026, '2026-03-02', 40]]) {
    const name = 'MSI ' + seed + '/1 (dados fictícios)';
    const demo = generateDemo({ seed, turma: 'MSI ' + seed + '/1', start, weeks: 18, students });
    const c = completeOffer({ name, log: parseLog(demo.logText), completion: parseCompletion(demo.completionText), demo: true }, state.absenceLimit);
    state = addClass(state, c).state;
  }
  changeView('analysis', { ...state, view: 'analysis', tab: 'triage', draft: null });
}

function openTab(tab) {
  notice('');
  update({ tab }, '#tab-' + tab);
}

function bindPage() {
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.tab) openTab(button.dataset.tab);
    switch (button.dataset.action) {
      case 'help': if (currentState.view !== 'help') changeView('help', { returnView: currentState.view }); break;
      case 'back': changeView(currentState.returnView ?? 'upload'); break;
      case 'upload': changeView('upload', { draft: null }); break;
      case 'demo': showDemo(); break;
      case 'copy': void copyGroup(button.dataset.group); break;
    }
  });
  document.addEventListener('keydown', event => {
    const i = tabs.findIndex(([id]) => event.target.dataset.tab === id);
    if (i === -1) return;
    const positions = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 };
    if (!Object.hasOwn(positions, event.key)) return;
    event.preventDefault();
    openTab(tabs[positions[event.key]][0]);
  });
  document.addEventListener('submit', event => {
    if (!['upload-form', 'review-form'].includes(event.target.id)) return;
    event.preventDefault();
    if (event.target.id === 'upload-form') void submitUpload(event.target);
    else submitReview(event.target);
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'absence-limit') {
      const absenceLimit = Number(event.target.value);
      const classes = currentState.classes.map(c => completeOffer(c, absenceLimit));
      notice('');
      update({ classes, absenceLimit }, '#absence-limit');
    }
    if (event.target.id === 'active-class') {
      notice('');
      update({ activeIndex: Number(event.target.value) }, '#active-class');
    }
    if (event.target.type === 'file') fileError(event.target, '');
  });
  for (const type of ['dragover', 'dragleave', 'drop']) {
    document.addEventListener(type, event => {
      const zone = event.target.closest('[data-drop]');
      if (!zone) {
        if (type === 'drop' && event.dataTransfer?.files.length) event.preventDefault();
        return;
      }
      event.preventDefault();
      zone.classList.toggle('dragging', type === 'dragover');
      if (type !== 'drop' || !event.dataTransfer.files.length) return;
      const input = document.getElementById(zone.dataset.drop);
      const transfer = new DataTransfer();
      transfer.items.add(event.dataTransfer.files[0]);
      input.files = transfer.files;
      fileError(input, '');
    });
  }
  render(currentState);
}

if (typeof document !== 'undefined') bindPage();

export function triageGroups(c) {
  return PATTERNS.slice(1, -1).map(pattern => {
    const first = pattern.id === 'afastamento';
    const students = c.students.filter(row => row.pattern === pattern.id || (first && row.pattern === 'sem-acesso'));
    students.sort((a, b) => (b.daysSinceLast ?? Infinity) - (a.daysSinceLast ?? Infinity));
    return { ...pattern, label: first ? 'Sem acesso ou afastamento' : pattern.label, students };
  });
}

export function studentReason(row, weeks) {
  switch (row.pattern) {
    case 'sem-acesso': return 'nenhum acesso no período';
    case 'afastamento': return `sem acesso há ${row.daysSinceLast} dias`;
    case 'queda': return `${row.firstHalfWeeks} semanas com acesso na 1ª metade, ${row.secondHalfWeeks} na 2ª`;
    case 'concentrado': return `acessos em ${row.daysActive} dias`;
    default: return `${row.weeksActive} de ${weeks} semanas com acesso`;
  }
}

const accessReminder = 'Acesso ao Moodle não é o mesmo que participação ou aprendizagem. Use estes sinais para conversar com o estudante.';
const numberPt = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const shownName = (row, state) => state.anonymize ? row.code : row.name;

function classNumbers(c) {
  const summary = summarizeClass(c);
  const metrics = [
    [summary.n, 'Estudantes'],
    [numberPt(summary.medianWeeksActive) + ' de ' + c.weeks, 'Semanas com acesso (mediana)'],
    [c.students.filter(row => row.longestAbsence >= c.absenceLimit).length, 'Estudantes com ausência de ' + c.absenceLimit + '+ dias'],
    [summary.patternCounts['sem-acesso'] + summary.patternCounts.afastamento, 'Sem acesso ou em afastamento'],
  ];
  return `<dl class="class-numbers">${metrics.map(([value, label]) =>
    `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}

function patternRules() {
  const texts = [
    'Nenhum acesso no período. Aparece com o relatório de conclusão.',
    'Dias desde o último acesso iguais ou superiores ao limite.',
    'Pelo menos 3 semanas com acesso na primeira metade e, na segunda, no máximo metade desse número.',
    'Acesso em menos de 40% das semanas, com mais da metade dos dias de acesso concentrados em até duas semanas.',
    'Acesso em menos de 70% das semanas ou uma ausência igual ou superior ao limite.',
    'Demais casos.',
  ];
  return `<details class="pattern-rules"><summary>Como os padrões são definidos</summary>
    <ol>${PATTERNS.map(({ label }, index) => `<li><strong>${label}.</strong> ${texts[index]}</li>`).join('')}</ol>
    <p>A primeira regra atendida define o padrão. Em períodos com um número ímpar de semanas, a semana do meio entra na primeira metade.</p></details>`;
}

function groupCards(c, state, copying = true) {
  const card = row => `<li><strong>${uiEscape(shownName(row, state))}</strong><span>${studentReason(row, c.weeks)}</span></li>`;
  const regular = c.students.filter(row => row.pattern === 'regular');
  const groups = triageGroups(c);
  return `<div class="triage-grid">${groups.map(group => `<section class="pattern-group">
    <div class="group-head"><h2 class="tag ${group.tone}">${group.label}</h2><strong class="group-count">${group.students.length}</strong></div>
    <p class="mediation">Sugestão: ${group.strategy}</p>
    ${group.students.length ? `<ul class="student-cards">${group.students.map(card).join('')}</ul>` : '<p class="muted">Nenhum estudante neste grupo.</p>'}
    ${copying ? `<button type="button" data-action="copy" data-group="${group.id}" aria-label="Copiar lista de ${group.label.toLowerCase()}"${group.students.length ? '' : ' disabled'}>Copiar lista</button>` : ''}
    </section>`).join('')}</div>${copying ? `<details class="regular-list"><summary>Regular (${regular.length})</summary>
    <ul class="student-cards">${regular.map(card).join('')}</ul></details>` : `<section class="regular-list"><h2>Regular (${regular.length})</h2>
    <ul class="student-cards">${regular.map(card).join('')}</ul></section>`}`;
}

function triageView(state, c) {
  return `<div class="stack triage">
    <div class="section-head"><div><h1 data-view-heading tabindex="-1">Quem precisa de contato</h1><p class="muted">${periodLabel(c.period)}</p></div>
      <label class="field">Limite de ausência <select id="absence-limit">${[7, 14, 21].map(limit =>
        `<option value="${limit}"${c.absenceLimit === limit ? ' selected' : ''}>${limit} dias</option>`).join('')}</select></label></div>
    ${classNumbers(c)}
    <p class="reminder">${accessReminder}</p>
    ${c.warnings.map(warning => `<p class="muted">${warning}</p>`).join('')}
    ${groupCards(c, state)}
    ${patternRules()}
  </div>`;
}

async function copyGroup(id) {
  const c = activeClass(currentState);
  const group = triageGroups(c).find(group => group.id === id);
  const list = group.students.map(row => shownName(row, currentState)).join('\n');
  notice('');
  try {
    await navigator.clipboard.writeText(list);
    notice('Lista copiada');
  } catch {
    const noticeBox = document.querySelector('#notice');
    if (activeClass(currentState) !== c || currentState.view !== 'analysis' || currentState.tab !== 'triage') return;
    notice('Selecione e copie a lista abaixo.');
    const input = document.createElement('textarea');
    input.readOnly = true;
    input.rows = Math.min(group.students.length, 8);
    input.setAttribute('aria-label', 'Lista de estudantes para copiar');
    input.value = list;
    noticeBox.append(input);
    input.focus();
    input.select();
  }
}
