import { buildClass, parseLog, parseCompletion, normalizeName, FormatError, PATTERNS, summarizeClass, titleCompare, titlePatterns, weeklySeries, titleWeekly, sustainedDeclineWeek, daysBetween, shiftDay } from './core.js';
import { escapeMarkup, lineChart, patternBars, barChartH, scatterChart } from './charts.js';
import { DEMO_OFFERINGS, generateDemo } from './demo.js';
import { buildXlsx } from './xlsx.js';

const VIDEO_AJUDA = '';
const webChartWidth = 1000;
const tabs = [
  ['triage', 'Quem precisa de contato'], ['diary', 'Diário semanal'],
  ['compare', 'Comparar turmas'], ['completion', 'Conclusão de atividades'],
];
const limitPreferenceKey = 'fica.limite-ausencia';
const initialState = { classes: [], activeIndex: -1, tab: 'triage', absenceLimit: 14, view: 'upload' };
let currentState = { ...initialState, absenceLimit: loadAbsenceLimit() };
let preservedForm = null;

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
const lowerParticles = new Set(['da', 'das', 'de', 'do', 'dos', 'e', 'di', 'du', 'van', 'von']);

// Nomes exportados do Moodle chegam às vezes em caixa alta. Só a exibição muda; o CSV mantém o original.
export function displayName(name) {
  const text = String(name ?? '').trim();
  if (!text || text !== text.toLocaleUpperCase('pt-BR') || text === text.toLocaleLowerCase('pt-BR')) return text;
  return text.toLocaleLowerCase('pt-BR').split(/(\s+|-)/).map((part, i) =>
    i > 0 && lowerParticles.has(part) ? part : part.charAt(0).toLocaleUpperCase('pt-BR') + part.slice(1)).join('');
}
const shownName = name => uiEscape(displayName(name));

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
    <div class="nav-tools">${state.classes.length > 1 ? `<label class="class-select">Turma <select id="active-class">${choices}</select></label>` : ''}
    <div class="export-actions" role="group" aria-label="Exportar análise">
      <button type="button" data-action="download">Baixar .xlsx</button>
      <button type="button" data-action="print" aria-describedby="print-hint">Imprimir / PDF</button>
    </div><p id="print-hint" class="print-hint">Na impressão, desmarque “Cabeçalhos e rodapés”.</p></div></div>`;
}

const sampleSheet = [
  ['Maria', [4,3,4,3,4,4,3,4,3,4], 'Regular', 'green'],
  ['João', [3,3,1,0,0,0,0,0,0,0], 'Afastamento', 'red'],
  ['Ana', [2,0,3,0,1,0,2,0,3,0], 'Irregular', 'amber'],
  ['Pedro', [4,4,3,3,2,1,1,0,0,0], 'Queda progressiva', 'amber'],
  ['Lúcia', [1,0,0,4,0,0,0,3,0,0], 'Acesso concentrado', 'amber'],
  ['Rafael', [3,4,3,3,4,3,3,4,3,3], 'Regular', 'green'],
  ['Bia', [2,3,3,2,3,2,3,3,2,3], 'Regular', 'green'],
];

const tickShapes = [
  'M3 11.5 8.2 16.8 17.2 3.6', 'M2.6 12.2 7.6 16.2 16.6 4.4', 'M3.4 10.8 8.6 17 17.6 4.8', 'M2.8 11.8 7.8 16.4 17 3.2',
];
const sheetNotes = ['', 'sem acesso desde a S4', '', 'menos dias a cada semana', 'quase tudo na S4 e S8', '', ''];

function sampleSheetView() {
  const head = Array.from({ length: 10 }, (_, w) => `<th scope="col" class="w${w >= 6 ? ' extra' : ''}">S${w + 1}</th>`).join('');
  const rows = sampleSheet.map(([name, days, label, tone], r) => {
    const cells = days.map((n, w) => {
      const ring = r === 1 && w === 3 ? '<svg class="ring" viewBox="0 0 40 30" aria-hidden="true"><path pathLength="1" d="M20 3C32 2 38 9 37 16 36 24 27 28 18 27 8 26 2 20 4 12 6 5 14 3 24 4"/></svg>' : '';
      const mark = n ? `<svg class="tick d${n}" viewBox="0 0 20 20" aria-hidden="true"><path pathLength="1" d="${tickShapes[(r * 3 + w) % 4]}"/></svg><span class="sr">${n} ${n === 1 ? 'dia' : 'dias'}</span>` : '<span class="sr">sem acesso</span>';
      return `<td class="w${w >= 6 ? ' extra' : ''}">${mark}${ring}</td>`;
    }).join('');
    return `<tr><th scope="row">${name}</th>${cells}<td class="note"><span class="tag ${tone}">${label}</span>${sheetNotes[r] ? `<em>${sheetNotes[r]}</em>` : ''}</td></tr>`;
  }).join('');
  return `<div class="sheet-scroll"><table class="sheet"><caption>Exemplo com dados fictícios: dias com acesso por semana</caption>
    <thead><tr><th scope="col">Estudante</th>${head}<th scope="col">Padrão</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="sheet-key muted">Traço mais firme = mais dias com acesso na semana. Espaço em branco = nenhum acesso.</p>`;
}

function uploadView(state) {
  return `<section class="start"><div class="intro"><h1 class="wordmark" data-view-heading tabindex="-1"><span class="word">fica</span>
      <span class="meaning">Frequência e Indicadores de Continuidade no AVA</span></h1>
      <p class="question">Quem pode precisar de <mark>contato</mark> nesta semana?</p>
      <p>A FICA lê o log do Moodle e mostra, estudante por estudante, quem está se afastando e como a turma se distribui pelas semanas.</p></div>
    <div class="sheet-wrap">${sampleSheetView()}</div>
    <aside class="ticket"><h2>Sua turma entra aqui</h2>
    <p class="pointer" aria-hidden="true"><span>comece<br>por aqui</span><svg viewBox="0 0 90 40"><path d="M4 8C30 4 56 12 80 30"/><path d="M66 30 81 31 76 17"/></svg></p>
    <form id="upload-form" class="stack">
      <div class="drop field big" data-drop="log-file">
        <label for="log-file">Log do curso (obrigatório)</label><input type="file" id="log-file" accept=".csv,text/csv" aria-describedby="log-file-hint log-file-error">
        <small id="log-file-hint" class="muted pick-hint">Arraste o CSV até aqui ou escolha o arquivo.</small>
        <div id="log-file-error" class="error" role="alert"></div></div>
      <div class="drop field" data-drop="completion-file">
        <label for="completion-file">Conclusão de atividades <span class="muted">(opcional)</span></label><input type="file" id="completion-file" accept=".csv,text/csv" aria-describedby="completion-file-hint completion-file-error">
        <small id="completion-file-hint" class="muted pick-hint">Mostra o que cada estudante concluiu.</small>
        <div id="completion-file-error" class="error" role="alert"></div></div>
      <div class="field"><label for="class-name">Nome da turma <span class="muted">(opcional)</span></label><input id="class-name" placeholder="Ex.: Introdução à Informática · 2026/1"></div>
      <button type="submit" class="primary go">Analisar a turma</button>
      <p class="privacy"><strong>Os arquivos são lidos só no seu computador.</strong> Nada é enviado para a internet.</p>
      <div class="actions">
        <button type="button" class="link" data-action="demo">Ver exemplo com dados fictícios</button>
        ${state.classes.length ? '<button type="button" data-action="return-analysis">Voltar à análise</button>' : ''}</div>
    </form></aside>
    <div class="tray" aria-hidden="true"><svg viewBox="0 0 300 64"><rect x="14" y="14" width="96" height="40" rx="6" fill="#c58b4e"/><rect x="14" y="14" width="96" height="17" rx="6" fill="#2b2b29"/><path d="M22 40h80" stroke="#a06f38" stroke-width="2" stroke-linecap="round"/><rect x="142" y="38" width="62" height="14" rx="7" fill="#f4f1e6" transform="rotate(-5 173 45)"/><rect x="222" y="40" width="46" height="12" rx="6" fill="#f3d65e" transform="rotate(3 245 46)"/><path d="M276 50c3-2 8-2 10 0" stroke="#f4f1e6" stroke-width="2" stroke-linecap="round" opacity=".6"/></svg></div></section>`;
}

function showPicked(input) {
  const hint = document.getElementById(input.id + '-hint');
  const file = input.files?.[0];
  if (!hint) return;
  hint.dataset.initial ??= hint.textContent;
  hint.textContent = file ? `${file.name} · ${Math.max(1, Math.round(file.size / 1024)).toLocaleString('pt-BR')} KB, pronto para analisar` : hint.dataset.initial ?? hint.textContent;
  input.closest('.drop')?.classList.toggle('picked', Boolean(file));
}

function reviewView(c) {
  const participants = [
    ...c.students.map(({ name }) => ({ label: name, staff: false })),
    ...c.staff.map(name => ({ label: name, staff: true })),
  ];
  return `<section class="surface narrow stack"><h1 data-view-heading tabindex="-1">Conferir turma</h1>
    <p>${c.students.length} estudantes · ${c.staff.length} pessoas da equipe</p>
    ${c.warnings.map(warning => `<p class="muted">${warning}</p>`).join('')}
    ${currentState.classes.some(other => normalizeName(other.name) === normalizeName(c.name)) ? '<p class="notice">Já existe uma turma com este nome. Ela será substituída. Para comparar as duas, mude o nome (por exemplo, com o ano e o semestre).</p>' : ''}
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
  if (state.tab === 'triage') return triageView(c);
  if (state.tab === 'diary') return diaryView(state, c);
  if (state.tab === 'compare') return compareView(state, c);
  return completionView(c);
}

export function render(state) {
  currentState = state;
  const c = activeClass(state);
  document.querySelector('#top-class').textContent = c?.name ?? '';
  document.documentElement?.classList?.toggle('on-start', state.view === 'upload' || !state.view);
  const loadButton = document.querySelector('#load-button');
  loadButton.hidden = state.view === 'upload';
  loadButton.textContent = state.classes.length ? 'Carregar outra turma' : 'Carregar arquivos';
  document.querySelector('#navigation').innerHTML = navigation(state);
  const main = document.querySelector('main');
  if (state.view === 'help') main.innerHTML = helpView();
  else if (state.view === 'review') main.innerHTML = reviewView(state.draft);
  else if (state.view === 'analysis' && c) {
    main.innerHTML = (c.demo ? '<p class="demo-band">Dados fictícios de demonstração</p>' : '') +
      `<section role="tabpanel" id="panel-${state.tab}" aria-labelledby="tab-${state.tab}">${analysisView(state, c)}</section>` +
      tabs.filter(([id]) => id !== state.tab).map(([id]) =>
        `<section role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" hidden></section>`).join('');
  } else main.innerHTML = uploadView(state);
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
  button.disabled = false;
  if (!form.isConnected) return;
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
  const typed = form.querySelector('#class-name').value.trim();
  let draft = completeOffer({ name: typed || log.course || 'Turma', log, completion }, currentState.absenceLimit);
  if (!typed && draft.period?.start) {
    const [year, month] = draft.period.start.split('-');
    draft = { ...draft, name: `${log.course || 'Turma'} · ${year}/${Number(month) <= 6 ? 1 : 2}` };
  }
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
  changeView('analysis', { ...state, view: 'analysis', tab: 'triage', draft: null, studentIndex: null });
  if (replaced) notice('A turma que já estava aberta foi substituída.');
}

function showDemo() {
  let state = currentState;
  for (const offering of DEMO_OFFERINGS) {
    const turma = 'MSI ' + offering.turma;
    const name = turma + ' (dados fictícios)';
    const demo = generateDemo({ ...offering, turma });
    const c = completeOffer({ name, log: parseLog(demo.logText), completion: parseCompletion(demo.completionText), demo: true }, state.absenceLimit);
    state = addClass(state, c).state;
  }
  changeView('analysis', { ...state, view: 'analysis', tab: 'triage', draft: null, studentIndex: null });
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
      case 'help':
        if (currentState.view === 'help') break;
        preservedForm = document.querySelector('main form');
        changeView('help', { returnView: currentState.view });
        break;
      case 'back': {
        changeView(currentState.returnView ?? 'upload');
        if (preservedForm) document.querySelector('main form')?.replaceWith(preservedForm);
        preservedForm = null;
        break;
      }
      case 'upload':
        preservedForm = null;
        changeView('upload', { draft: null });
        break;
      case 'return-analysis': changeView('analysis'); break;
      case 'demo': showDemo(); break;
      case 'download': downloadSpreadsheet(activeClass(currentState)); break;
      case 'print': window.print(); break;
      case 'copy': void copyGroup(button.dataset.group); break;
      case 'diary-filter': update({ diaryFilter: button.dataset.filter, studentIndex: null }, '#filter-' + button.dataset.filter); break;
      case 'student-detail': {
        const { scrollLeft, scrollTop } = document.querySelector('.matrix-scroll');
        update({ studentIndex: Number(button.dataset.index) }, '#detail-title');
        Object.assign(document.querySelector('.matrix-scroll'), { scrollLeft, scrollTop });
        break;
      }
      case 'close-detail': update({ studentIndex: null }, '#student-' + currentState.studentIndex); break;
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
    if (event.target.id === 'diary-sort') update({ diarySort: event.target.value }, '#diary-sort');
    if (event.target.id === 'absence-limit') {
      const absenceLimit = Number(event.target.value);
      saveAbsenceLimit(absenceLimit);
      const classes = currentState.classes.map(c => completeOffer(c, absenceLimit));
      notice('');
      update({ classes, absenceLimit }, '#absence-limit');
    }
    if (event.target.id === 'active-class') {
      notice('');
      update({ activeIndex: Number(event.target.value), studentIndex: null }, '#active-class');
    }
    if (event.target.type === 'file') { fileError(event.target, ''); showPicked(event.target); }
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
      showPicked(input);
    });
  }
  window.addEventListener('beforeprint', () => printReport(activeClass(currentState)));
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
    case 'sem-acesso': return 'nenhum acesso na disciplina';
    case 'afastamento': return row.activeDays?.length ? `último acesso em ${row.activeDays.at(-1).split('-').reverse().slice(0, 2).join('/')} · ${row.daysSinceLast} dias sem acesso` : `${row.daysSinceLast} dias sem acesso`;
    case 'queda': return `${row.firstHalfWeeks} semanas com acesso na 1ª metade, ${row.secondHalfWeeks} na 2ª`;
    case 'concentrado': return `acessos em ${row.daysActive} dias`;
    default: return `${row.weeksActive} de ${weeks} semanas com acesso`;
  }
}

const numberPt = value => value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

function classSummary(c) {
  const summary = summarizeClass(c);
  const urgent = triageGroups(c).slice(0, 2).reduce((total, group) => total + group.students.length, 0);
  return `<p class="class-summary"><span><strong>${summary.n.toLocaleString('pt-BR')}</strong> ${summary.n === 1 ? 'estudante' : 'estudantes'}</span>
    <span><strong>${urgent.toLocaleString('pt-BR')}</strong> para contatar agora</span>
    <span>mediana de <strong>${numberPt(summary.medianWeeksActive)} de ${c.weeks}</strong> semanas com acesso</span></p>`;
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

const visibleNames = 8;

function nameList(c, students, limit, showReason = true) {
  const item = row => `<li><span class="who">${shownName(row.name)}</span>${showReason ? `<span class="why">${studentReason(row, c.weeks)}</span>` : ''}</li>`;
  if (!students.length) return '<p class="empty">Ninguém neste padrão.</p>';
  const rest = limit ? students.slice(limit) : [];
  return `<ul class="names">${students.slice(0, limit || undefined).map(item).join('')}</ul>${rest.length ? `<details class="more">
    <summary>Ver todos (${students.length})</summary><ul class="names">${rest.map(item).join('')}</ul></details>` : ''}`;
}

function groupBlock(c, group, copying, limit) {
  return `<section class="group" aria-labelledby="group-${group.id}">
    <div class="group-head"><h3 id="group-${group.id}">${group.label}</h3><strong class="group-count">${group.students.length}</strong></div>
    <p class="mediation">${group.strategy}</p>
    ${nameList(c, group.students, copying ? limit : 0)}
    ${copying && group.students.length ? `<button type="button" class="copy" data-action="copy" data-group="${group.id}" aria-label="Copiar lista de ${group.label.toLowerCase()}">Copiar lista</button>` : ''}
  </section>`;
}

function groupCards(c, copying = true) {
  const regular = c.students.filter(row => row.pattern === 'regular');
  const groups = triageGroups(c);
  return `<section class="zone urgent" aria-labelledby="zone-now"><h2 id="zone-now">Contatar agora</h2>
      <div class="zone-groups">${groups.slice(0, 2).map(group => groupBlock(c, group, copying, visibleNames)).join('')}</div></section>
    <section class="zone watch" aria-labelledby="zone-watch"><h2 id="zone-watch">Acompanhar</h2>
      <div class="zone-groups">${groups.slice(2).map(group => groupBlock(c, group, copying, 5)).join('')}</div></section>
    ${copying ? `<details class="regular-list"><summary>Regular (${regular.length})</summary>${nameList(c, regular, 0)}</details>`
      : `<section class="regular-list"><h2>Regular (${regular.length})</h2>${nameList(c, regular, 0, false)}</section>`}`;
}

function triageView(c) {
  return `<div class="stack triage">
    <div class="section-head"><div class="head-text"><h1 data-view-heading tabindex="-1">Quem precisa de contato</h1>
      ${classSummary(c)}<p class="muted period">${periodLabel(c.period)} · ${referenceNote(c)}</p></div>
      <label class="field limit">Limite de ausência <select id="absence-limit">${[7, 14, 21].map(limit =>
        `<option value="${limit}"${c.absenceLimit === limit ? ' selected' : ''}>${limit} dias</option>`).join('')}</select></label></div>
    ${c.warnings.map(warning => `<p class="muted">${warning}</p>`).join('')}
    ${groupCards(c)}
    ${patternRules()}
  </div>`;
}

async function copyGroup(id) {
  const c = activeClass(currentState);
  const group = triageGroups(c).find(group => group.id === id);
  const list = group.students.map(row => displayName(row.name)).join('\n');
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

export function tintLevel(days) {
  if (days <= 2) return days;
  return days <= 4 ? 3 : 4;
}

function tagFor(pattern) {
  const { label, tone } = PATTERNS.find(({ id }) => id === pattern);
  return `<span class="tag ${tone === 'green' ? 'calm' : 'note'}">${label}</span>`;
}

function reportTable(caption, headings, rows) {
  return `<div class="table-scroll" tabindex="0" role="region" aria-label="${uiEscape(caption)}">
    <table class="report-table"><caption>${uiEscape(caption)}</caption><thead><tr>${headings.map(heading =>
      `<th scope="col">${uiEscape(heading)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([label, ...values]) => `<tr><th scope="row">${uiEscape(label)}</th>${values.map(value =>
        `<td>${uiEscape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function chartFigure(svg, label, equivalent) {
  return `<figure class="chart"><div class="chart-scroll" tabindex="0" role="region" aria-label="${uiEscape(label)}">${svg}</div>
    <details class="chart-data"><summary>Ver tabela · ${uiEscape(label)}</summary>${equivalent}</details></figure>`;
}

function weeklyGraphic(c, print = false) {
  const series = weeklySeries(c);
  const week = sustainedDeclineWeek(series);
  const title = c.students.length ? titleWeekly(series) : 'A turma está sem estudantes identificados';
  const svg = lineChart({
    title, subtitle: 'Percentual de estudantes com acesso por semana · ' + periodLabel(c.period),
    series: [{ label: 'Turma', values: series.map(row => row.pct), highlight: true }],
    xLabels: series.map(row => 'S' + row.week), width: print ? 1000 : webChartWidth, height: print ? 150 : undefined, print,
    annotation: week === null || !c.students.length ? undefined : { index: week - 1, text: 'Menos de 50%' },
  });
  if (print) return svg;
  return chartFigure(svg, 'Acesso semanal', reportTable('Acesso semanal', ['Semana', 'Estudantes com acesso', 'Percentual'],
    series.map(({ week, n, pct }) => ['S' + week, n, numberPt(pct) + '%'])));
}

function detailView(row, c) {
  if (!row) return '';
  const pattern = PATTERNS.find(item => item.id === row.pattern);
  const active = new Set(row.activeDays);
  const days = Array.from({ length: daysBetween(c.period.start, c.period.end) + 1 }, (_, i) => {
    const key = shiftDay(c.period.start, i);
    const [status, css] = key > c.refDate ? ['fora da janela observada', 'unobserved']
      : active.has(key) ? ['com acesso', 'visited'] : ['sem acesso', ''];
    const label = key.split('-').reverse().join('/') + ' · ' + status;
    return `<li class="${css}" title="${label}" aria-label="${label}"></li>`;
  }).join('');
  const measures = [
    ['Acessos', row.accesses], ['Dias com acesso', row.daysActive], ['Semanas com acesso', row.weeksActive + ' de ' + c.weeks],
    ['Maior ausência (dias)', row.longestAbsence], ['Dias desde o último acesso', row.daysSinceLast ?? '—'],
    ['Ausências de 7+ dias', row.gaps7], ['Ausências de 14+ dias', row.gaps14], ['Ausências de 21+ dias', row.gaps21],
    ['Semanas com acesso na 1ª metade', row.firstHalfWeeks], ['Semanas com acesso na 2ª metade', row.secondHalfWeeks],
  ];
  const completed = c.activities.filter((_, index) => row.done?.[index]);
  return `<section class="surface stack" aria-labelledby="detail-title">
    <div class="section-head"><h2 id="detail-title" tabindex="-1">${shownName(row.name)}</h2>
    <button type="button" data-action="close-detail">Fechar detalhe</button></div>
    <p>${tagFor(row.pattern)} ${pattern.strategy}</p>
    <div class="stack"><h3>Linha do tempo diária</h3><ul class="daily-track" aria-label="Dias do período">${days}</ul>
      <p class="muted">Verde indica acesso. Creme indica dia sem acesso. Tracejado indica dia fora da janela observada.</p></div>
    ${reportTable('Indicadores individuais', ['Indicador', 'Valor'], measures)}
    ${c.hasCompletion ? `<div><h3>Atividades concluídas${row.done ? ' (' + row.completed + ' de ' + row.completionTotal + ')' : ''}</h3>
      ${completed.length ? `<ul>${completed.map(activity => `<li>${uiEscape(activity)}</li>`).join('')}</ul>`
        : `<p>${row.done ? 'Nenhuma atividade concluída.' : 'Sem registro no relatório de conclusão.'}</p>`}</div>` : ''}
  </section>`;
}

function diaryView(state, c) {
  const { diarySort = 'name', diaryFilter = 'all', studentIndex } = state;
  const students = c.students.filter(row => diaryFilter === 'all' || row.pattern === diaryFilter);
  const order = PATTERNS.map(({ id }) => id);
  if (diarySort === 'pattern') students.sort((a, b) => order.indexOf(a.pattern) - order.indexOf(b.pattern));
  if (diarySort === 'weeks') students.sort((a, b) => b.weeksActive - a.weeksActive);
  const filters = [{ id: 'all', label: 'Todos' }, ...PATTERNS];
  const sorts = [['name', 'Nome'], ['pattern', 'Padrão'], ['weeks', 'Semanas com acesso']];
  const headings = Array.from({ length: c.weeks }, (_, i) => `<th scope="col">S${i + 1}</th>`).join('');
  const rows = students.map(row => `<tr><th scope="row"><button type="button" class="link" data-action="student-detail"
    id="student-${c.students.indexOf(row)}" data-index="${c.students.indexOf(row)}">${shownName(row.name)}</button></th>
    ${row.weeklyDays.map((days, i) => {
      const label = `S${i + 1}: ${days} ${days === 1 ? 'dia' : 'dias'} com acesso`;
      return `<td class="t${tintLevel(days)}" title="${label}" aria-label="${label}">${days}</td>`;
    }).join('')}<td>${tagFor(row.pattern)}</td></tr>`).join('');
  return `<div class="stack"><div><h1 data-view-heading tabindex="-1">Diário semanal</h1>
    <p class="muted">${periodLabel(c.period)} · ${referenceNote(c)}</p></div>
    ${weeklyGraphic(c)}
    <div class="section-head"><h2>Dias com acesso por estudante</h2><label class="field">Ordenar por
      <select id="diary-sort">${sorts.map(([value, label]) =>
        `<option value="${value}"${value === diarySort ? ' selected' : ''}>${label}</option>`).join('')}</select></label></div>
    <div class="filters" role="group" aria-label="Filtrar por padrão">
      ${filters.map(({ id, label }) => `<button type="button" id="filter-${id}" data-action="diary-filter" data-filter="${id}" aria-pressed="${diaryFilter === id}">${label}</button>`).join('')}</div>
    <div class="matrix-key"><strong>Dias com acesso na semana</strong>
      ${['0', '1', '2', '3–4', '5–7'].map((label, i) => `<span class="key-chip t${i}">${label}</span>`).join('')}</div>
    ${students.length ? `<div class="table-scroll matrix-scroll" tabindex="0" role="region" aria-label="Matriz de acesso semanal">
      <table class="matrix" aria-label="Dias com acesso em cada semana"><thead><tr><th scope="col">Estudante</th>${headings}<th scope="col">Padrão</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : '<p class="surface">Nenhum estudante neste filtro.</p>'}
    ${detailView(students.find(row => row === c.students[studentIndex]), c)}
  </div>`;
}

export function compareRows(summaries) {
  const rows = [
    ['Estudantes', s => numberPt(s.n)],
    ['Período', s => periodLabel({ start: s.start, end: s.end })],
    ['Semanas', s => numberPt(s.weeks)],
    ['Mediana de semanas com acesso', s => numberPt(s.medianWeeksActive)],
    ['Mediana da maior ausência (dias)', s => numberPt(s.medianLongestAbsence)],
    ['Estudantes com ausência de 14+ dias', s => numberPt(s.studentsWithGap14)],
    ...PATTERNS.map(({ id, label }) => [label, s => s.patternCounts[id] + ' (' + numberPt(s.patternPct[id]) + '%)']),
    ['Mediana de atividades concluídas', s => s.medianCompletionPct === null ? '—' : numberPt(s.medianCompletionPct) + '%'],
  ];
  return rows.map(([label, format]) => ({ label, values: summaries.map(format) }));
}

function compareView(state, c) {
  const heading = '<h1 data-view-heading tabindex="-1">Comparar turmas</h1>';
  if (state.classes.length < 2) return `<section class="surface stack">${heading}
    <p>Carregue o log de outra turma para comparar. Cada turma precisa de um nome diferente, por exemplo com o ano e o semestre.</p><div><button type="button" data-action="upload">Carregar outra turma</button></div></section>`;
  const entries = state.classes.map(offer => ({ name: offer.name, series: weeklySeries(offer), highlight: offer === c }));
  const summaries = state.classes.map(summarizeClass);
  const names = entries.map(entry => entry.name);
  const weeks = Array.from({ length: Math.max(...state.classes.map(offer => offer.weeks)) }, (_, i) => 'S' + (i + 1));
  const weekly = lineChart({ title: titleCompare(entries), subtitle: 'Percentual de estudantes com acesso por semana · ofertas alinhadas por semana',
    series: entries.map(e => ({ label: e.name, values: e.series.map(row => row.pct), highlight: e.highlight })), xLabels: weeks, width: webChartWidth });
  const patterns = patternBars({ title: titlePatterns(summaries[state.activeIndex]),
    subtitle: 'Distribuição percentual dos padrões de acesso por oferta', width: webChartWidth,
    rows: summaries.map(s => ({ label: s.name, counts: s.patternCounts })) });
  return `<div class="stack">${heading}
    ${chartFigure(weekly, 'Acesso semanal por turma', reportTable('Percentual por semana', ['Semana', ...names], weeks.map((week, i) =>
      [week, ...entries.map(entry => entry.series[i] ? numberPt(entry.series[i].pct) + '%' : '—')])))}
    ${chartFigure(patterns, 'Padrões por turma', reportTable('Padrões por turma', ['Padrão', ...names],
      PATTERNS.map(({ id, label }) => [label, ...summaries.map(s => s.patternCounts[id] + ' (' + numberPt(s.patternPct[id]) + '%)')])))}
    ${reportTable('Indicadores por turma', ['Indicador', ...names], compareRows(summaries).map(({ label, values }) => [label, ...values]))}
  </div>`;
}

function rankValues(values) {
  const order = values.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value);
  const result = Array(values.length);
  for (let start = 0; start < order.length;) {
    let end = start + 1;
    while (end < order.length && order[end].value === order[start].value) end++;
    const rank = (start + end + 1) / 2;
    for (let i = start; i < end; i++) result[order[i].i] = rank;
    start = end;
  }
  return result;
}

export function spearman(points) {
  const xs = rankValues(points.map(p => p.x));
  const ys = rankValues(points.map(p => p.y));
  const center = (points.length + 1) / 2;
  let cov = 0;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < points.length; i++) {
    const x = xs[i] - center;
    const y = ys[i] - center;
    cov += x * y;
    sumX += x * x;
    sumY += y * y;
  }
  return sumX && sumY ? cov / Math.sqrt(sumX * sumY) : 0;
}

function completionView(c) {
  const heading = '<h1 data-view-heading tabindex="-1">Conclusão de atividades</h1>';
  if (!c.hasCompletion) return `<section class="surface stack">${heading}
    <p>No Moodle, abra <strong>Relatórios → Conclusão de atividades</strong> e baixe o CSV. Carregue-o junto com o log da turma.</p>
    <div class="actions">${helpButton()}<button type="button" data-action="upload">Carregar arquivos</button></div></section>`;
  const eligible = c.students.filter(row => row.completionTotal);
  if (!eligible.length) return `<section class="surface stack">${heading}<p>O relatório está sem registros de conclusão para os estudantes desta turma.</p></section>`;
  const points = eligible.map(row => ({
    x: row.weeksActive, y: 100 * row.completed / row.completionTotal,
    label: displayName(row.name), highlight: row.pattern !== 'regular',
  }));
  const association = spearman(points);
  const title = association >= 0.3 ? 'Quem acessou mais semanas concluiu mais atividades'
    : association <= -0.3 ? 'Quem acessou mais semanas concluiu menos atividades'
      : 'Semanas com acesso e percentual de atividades concluídas por estudante';
  const scatter = scatterChart({ title, subtitle: 'Verde indica padrões de atenção · ' + periodLabel(c.period), points,
    xLabel: 'Semanas com acesso', yLabel: 'Atividades concluídas', width: webChartWidth });
  const ordered = c.activities.map((label, i) => ({ label,
    value: Math.round(1000 * eligible.filter(row => row.done[i]).length / eligible.length) / 10,
  })).sort((a, b) => a.value - b.value);
  const bars = ordered.map((bar, i) => ({ ...bar, highlight: i < 3 }));
  const lowest = bars[0];
  const byActivity = barChartH({ title: lowest.label + ' teve a menor conclusão (' + numberPt(lowest.value) + '%)',
    subtitle: 'Percentual dos ' + eligible.length + ' estudantes presentes na análise e no relatório de conclusão',
    bars, unit: '%', width: webChartWidth });
  return `<div class="stack">${heading}
    ${chartFigure(scatter, 'Acesso e conclusão por estudante', reportTable('Acesso e conclusão por estudante',
      ['Estudante', 'Semanas com acesso', 'Atividades concluídas'], points.map(p => [p.label, p.x, numberPt(p.y) + '%'])))}
    ${chartFigure(byActivity, 'Conclusão por atividade', reportTable('Conclusão por atividade',
      ['Atividade', 'Percentual de estudantes'], bars.map(bar => [bar.label, numberPt(bar.value) + '%'])))}
  </div>`;
}

function loadAbsenceLimit() {
  try {
    const value = Number(localStorage.getItem(limitPreferenceKey));
    if ([7, 14, 21].includes(value)) return value;
  } catch {
    // O armazenamento pode estar indisponível no modo offline ou privado.
  }
  return 14;
}

function saveAbsenceLimit(value) {
  try {
    localStorage.setItem(limitPreferenceKey, String(value));
  } catch {
    // O limite continua valendo até fechar a página.
  }
}

const dayPt = day => day ? day.split('-').reverse().join('/') : '';

export function referenceNote(c) {
  const why = c.refDate >= c.period.end ? 'fim da disciplina' : 'último registro do log';
  return `dias contados até ${dayPt(c.refDate)} (${why})`;
}

export function spreadsheet(c) {
  const headers = ['Estudante', 'Acessos', 'Dias com acesso', 'Semanas com acesso', 'Total de semanas',
    'Maior ausência (dias)', 'Último acesso', 'Dias sem acesso até a referência', 'Ausências 7+', 'Ausências 14+', 'Ausências 21+',
    'Atividades concluídas', 'Total de atividades', 'Padrão', 'Estratégia sugerida'];
  const rows = c.students.map(row => {
    const pattern = PATTERNS.find(item => item.id === row.pattern);
    return [row.name, row.accesses, row.daysActive, row.weeksActive, c.weeks, row.longestAbsence,
      dayPt(row.activeDays?.at(-1)), row.daysSinceLast, row.gaps7, row.gaps14, row.gaps21,
      row.completed, row.completionTotal, pattern.label, pattern.strategy];
  });
  const about = [
    ['Turma', c.name], ['Período', periodLabel(c.period)],
    ['Data de referência', dayPt(c.refDate) + (c.refDate >= c.period.end ? ' (fim da disciplina)' : ' (último registro do log)')],
    ['Limite de ausência', c.absenceLimit + ' dias'], ['', ''],
    ['Padrões', ''], ...PATTERNS.map(({ label, strategy }) => [label, strategy]), ['', ''],
    ['Observação', 'Acesso ao Moodle não é o mesmo que participação ou aprendizagem.'],
    ['Gerado pela FICA', 'Frequência e Indicadores de Continuidade no AVA'],
  ];
  return [
    { name: 'Estudantes', rows: [headers, ...rows], widths: [36, 10, 12, 12, 10, 14, 13, 16, 11, 11, 11, 13, 12, 22, 48] },
    { name: 'Sobre', rows: about, widths: [26, 70], header: false },
  ];
}

function downloadSpreadsheet(c) {
  const blob = new Blob([buildXlsx(spreadsheet(c))], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fica_' + (c.name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 100) || 'turma') + '.xlsx';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printReport(c) {
  const report = document.querySelector('#print-report');
  report.innerHTML = c ? `<header class="print-heading"><p class="print-brand">fica</p>
    <h1>${uiEscape(c.name)}</h1>
    <p class="print-period">${periodLabel(c.period)} · ${referenceNote(c)}${c.demo ? ' · <span class="print-demo">Dados fictícios de demonstração</span>' : ''}</p></header>
    ${classSummary(c)}
    <figure class="print-chart">${weeklyGraphic(c, true)}</figure>
    ${groupCards(c, false)}
    <footer class="print-footer">
      <p>${uiEscape(c.name)} · FICA · Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
      <p>© Profa. Jaline Mombach · jaline.mombach@iffarroupilha.edu.br</p>
    </footer>` : '';
  document.body?.classList.toggle('printing-class', Boolean(c));
}
