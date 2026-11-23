import { PATTERNS } from './core.js';

export function escapeMarkup(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

const chartInk = '#1f2a24';
const chartMuted = '#536159';
const chartContext = '#9aa0a6';
const chartAxes = '#7b847d';
const chartFocus = print => print ? '#1f5f3b' : '#2e8b57';

function svgText(x, y, value, options = '') {
  return `<text x="${x}" y="${y}" ${options}>${escapeMarkup(value)}</text>`;
}

function chartLines(value, limit) {
  const lines = [''];
  for (const word of value.split(/\s+/)) {
    const last = lines.at(-1);
    if (last && last.length + word.length + 1 > limit) lines.push(word);
    else lines[lines.length - 1] = (last + ' ' + word).trim();
  }
  return lines;
}

function makeChart({ title, subtitle, width, height }, draw) {
  const heading = chartLines(title, Math.floor(width / 12));
  const subheading = chartLines(subtitle, Math.floor(width / 8));
  const top = 28 + heading.length * 25 + subheading.length * 17;
  const headline = heading.map((line, i) => svgText(12, 24 + i * 25, line, 'font-size="20" font-weight="700"')).join('');
  const description = subheading.map((line, i) => svgText(12, 25 + heading.length * 25 + i * 17, line, `fill="${chartMuted}"`)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeMarkup(title)}" viewBox="0 0 ${width} ${height + top}" font-family="system-ui, sans-serif" font-size="13" fill="${chartInk}"><title>${escapeMarkup(title)}</title><desc>${escapeMarkup(subtitle)}</desc>${headline}${description}<g transform="translate(0 ${top})">${draw()}</g></svg>`;
}

export function lineChart({ title, subtitle, series, xLabels, yMax = 100, yUnit = '%', annotation,
  width = 760, height = 236, print = false }) {
  const margin = Math.min(width * 0.4, Math.max(84, ...series.map(item => item.label.length * 7.5 + 24)));
  const left = 48;
  const right = Math.max(left + 1, width - margin);
  const bottom = height - 28;
  const x = index => left + (right - left) * index / Math.max(1, xLabels.length - 1);
  const y = value => bottom - (bottom - 20) * value / (yMax || 1);
  return makeChart({ title, subtitle, width, height }, () => {
    const ticks = xLabels.map((label, i) => {
      const stride = Math.max(1, Math.ceil(xLabels.length / Math.max(2, (right - left) / 42)));
      return i % stride === 0 || i === xLabels.length - 1
        ? svgText(x(i), height - 7, label, `fill="${chartMuted}" text-anchor="middle"`) : '';
    }).join('');
    const axes = `<path d="M${left} 20V${bottom}H${right}" fill="none" stroke="${chartAxes}"/>` +
      svgText(left - 7, 24, yMax + yUnit, `text-anchor="end" fill="${chartMuted}"`) +
      svgText(left - 7, bottom + 4, 0 + yUnit, `text-anchor="end" fill="${chartMuted}"`) + ticks;
    const entries = series.filter(item => item.values.length).map(item => ({ ...item, labelY: y(item.values.at(-1)) }));
    let previous = -3;
    for (const item of [...entries].sort((a, b) => a.labelY - b.labelY)) {
      item.labelY = Math.max(item.labelY, previous + 15);
      previous = item.labelY;
    }
    const overflow = Math.max(0, previous - bottom);
    const lines = entries.map(({ label, values, highlight, labelY }) => {
      const color = highlight ? chartFocus(print) : chartContext;
      const points = values.map((value, index) => x(index) + ',' + y(value)).join(' ');
      const endX = x(values.length - 1);
      const endY = y(values.at(-1));
      const labelX = right + 12;
      labelY -= overflow;
      return `<polyline points="${points}" stroke="${color}" fill="none" stroke-width="${highlight ? 3 : 2}"/><circle cx="${endX}" cy="${endY}" r="3" fill="${color}"/>` +
        (Math.abs(labelY - endY) > 3 || endX < right ? `<path d="M${endX + 4} ${endY} L${labelX - 4} ${labelY}" fill="none" stroke="${color}"/>` : '') +
        svgText(labelX, labelY + 4, label, `fill="${highlight ? '#1f5f3b' : chartMuted}"`);
    }).join('');
    const focused = series.find(item => item.highlight) ?? series[0];
    const value = focused?.values[annotation?.index];
    if (value === undefined) return axes + lines;
    const px = x(annotation.index);
    const py = y(value);
    const rightSide = px < (left + right) / 2;
    return axes + lines + `<circle cx="${px}" cy="${py}" r="5" fill="${chartFocus(print)}"/>` +
      svgText(px + (rightSide ? 8 : -8), py < 42 ? py + 20 : py - 12, annotation.text,
        `fill="#1f5f3b" text-anchor="${rightSide ? 'start' : 'end'}"`);
  });
}

export function barChartH({ title, subtitle, bars, unit = '', print = false }) {
  const width = 760;
  const left = 252;
  const ordered = [...bars].sort((a, b) => a.value - b.value);
  const rows = ordered.map(bar => ({ ...bar, lines: chartLines(bar.label, 32) }));
  const height = rows.reduce((total, row) => total + Math.max(31, row.lines.length * 16 + 8), 8);
  const max = Math.max(unit === '%' ? 100 : 1, ...bars.map(bar => bar.value));
  return makeChart({ title, subtitle, width, height }, () => {
    let top = 0;
    return rows.map(({ value, highlight, lines }) => {
      const size = Math.max(31, lines.length * 16 + 8);
      const center = top + size / 2;
      top += size;
      const length = (width - left - 62) * value / max;
      return lines.map((line, i) => svgText(left - 9, center + 4 + (i - (lines.length - 1) / 2) * 16, line, 'text-anchor="end"')).join('') +
        `<rect x="${left}" y="${center - 8}" width="${length}" height="16" fill="${highlight ? chartFocus(print) : chartContext}"/>` +
        svgText(left + length + 7, center + 4, value.toLocaleString('pt-BR') + unit);
    }).join('');
  });
}

export function patternBars({ title, subtitle, rows, print = false }) {
  const width = 820;
  const left = 205;
  const span = width - left - 15;
  const colors = print ? ['#222', '#444', '#606060', '#808080', '#aaa', '#e1e1e1']
    : ['#a2281a', '#fbe3df', '#8a5a00', '#efd8a3', '#fbefcf', '#e1e1e1'];
  return makeChart({ title, subtitle, width, height: Math.max(40, rows.length * 63) }, () =>
    rows.map(({ label, counts }, index) => {
      let leftEdge = left;
      const top = index * 63 + 4;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const name = chartLines(label, 25).map((line, i) => svgText(left - 9, top + 15 + i * 15, line, 'text-anchor="end"')).join('');
      if (!total) return name + svgText(left, top + 18, 'Sem estudantes');
      return name + PATTERNS.map((pattern, i) => {
        const count = counts[pattern.id] ?? 0;
        if (!count) return '';
        const pct = 100 * count / total;
        const length = span * pct / 100;
        const x = leftEdge;
        leftEdge += length;
        const labelColor = (print ? i < 3 : i === 0 || i === 2) ? '#fff' : chartInk;
        const labels = chartLines(pattern.label, Math.max(7, Math.floor(length / 6)));
        const caption = pct < 8 ? '' : svgText(x + length / 2, top + 37, Math.round(pct) + '%', `text-anchor="middle" fill="${labelColor}"`) +
          labels.map((line, j) => svgText(x + length / 2, top + 14 + j * 11, line, `text-anchor="middle" font-size="10" fill="${labelColor}"`)).join('');
        return `<rect x="${x}" y="${top}" width="${length}" height="44" fill="${colors[i]}"><title>${pattern.label}: ${count}</title></rect>` + caption;
      }).join('');
    }).join(''));
}

export function scatterChart({ title, subtitle, points, xLabel, yLabel, print = false }) {
  const width = 680;
  const height = 250;
  const left = 54;
  const right = width - 30;
  const bottom = height - 52;
  const xMax = Math.max(1, ...points.map(point => point.x));
  const x = value => left + value / xMax * (right - left);
  const y = value => bottom - value / 100 * (bottom - 27);
  return makeChart({ title, subtitle, width, height }, () =>
    `<path d="M${left} 27V${bottom}H${right}" stroke="${chartAxes}" fill="none"/>` +
    svgText(left, 15, yLabel, `fill="${chartMuted}"`) +
    svgText(left - 7, 32, '100%', `text-anchor="end" fill="${chartMuted}"`) +
    svgText(left - 7, bottom + 4, '0%', `text-anchor="end" fill="${chartMuted}"`) +
    svgText(left, bottom + 20, '0', 'text-anchor="middle"') +
    svgText(right, bottom + 20, xMax, 'text-anchor="middle"') +
    svgText((left + right) / 2, height - 7, xLabel, `text-anchor="middle" fill="${chartMuted}"`) +
    [...points].sort((a, b) => Number(Boolean(a.highlight)) - Number(Boolean(b.highlight))).map(point =>
      `<circle cx="${x(point.x)}" cy="${y(point.y)}" r="5" fill="${point.highlight ? chartFocus(print) : chartContext}" fill-opacity=".78"><title>${escapeMarkup(point.label)} · ${point.x} · ${point.y.toLocaleString('pt-BR')}%</title></circle>`).join(''));
}
