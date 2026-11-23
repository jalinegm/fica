import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');

export function buildPage() {
  const js = '\n' + ['core.js', 'charts.js', 'demo.js', 'ui.js'].map(file =>
    source('./src/' + file).replace(/^import [^\n]+\n/gm, '').replace(/^export /gm, '').trimEnd()).join('\n\n') + '\n';
  const css = '\n' + source('./src/style.css').trimEnd() + '\n';
  if (/<\/script/i.test(js) || /<\/style/i.test(css)) throw new Error('Bloco inline contém uma tag de fechamento.');
  const sha = value => 'sha256-' + createHash('sha256').update(value, 'utf8').digest('base64');
  const csp = `default-src 'none'; script-src '${sha(js)}'; style-src '${sha(css)}'; img-src data:; media-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'`;
  const blocks = { CSP: csp, CSS: css, JS: js };
  const page = source('./src/template.html').replace(/\{\{(CSP|CSS|JS)\}\}/g, (_, key) => blocks[key]);
  writeFileSync(new URL('./index.html', import.meta.url), page, 'utf8');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) buildPage();
