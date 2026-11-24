import test from 'node:test';
import assert from 'node:assert/strict';
import { displayName } from '../src/ui.js';

test('names written in capitals are shown in title case with lowercase particles', () => {
  assert.equal(displayName('ANTONIO MARCUS GOMES DE ARAÚJO'), 'Antonio Marcus Gomes de Araújo');
  assert.equal(displayName('JOELLITON DA SILVA DO NASCIMENTO'), 'Joelliton da Silva do Nascimento');
  assert.equal(displayName('Diogo Rodrigues de Rodrigues'), 'Diogo Rodrigues de Rodrigues');
  assert.equal(displayName('andré cezar novaes'), 'andré cezar novaes');
});
