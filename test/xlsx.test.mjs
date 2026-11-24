import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, buildXlsx } from '../src/xlsx.js';

test('crc32 matches the reference value', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('workbook is a zip with the expected parts, numbers stay numeric and text is escaped', () => {
  const bytes = buildXlsx([{ name: 'Estudantes', rows: [['Nome', 'Dias'], ['Ana & <Bia>', 12]], widths: [30, 10] }, { name: 'Sobre', rows: [['Turma', 'X']], header: false }]);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const text = new TextDecoder().decode(bytes);
  for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']) assert.match(text, new RegExp(part.replace(/[[\].]/g, '\$&')));
  assert.match(text, /<c r="B2"><v>12<\/v><\/c>/);
  assert.match(text, /Ana &amp; &lt;Bia&gt;/);
  assert.match(text, /state="frozen"/);
  assert.match(text, /<autoFilter ref="A1:B2"\/>/);
});
