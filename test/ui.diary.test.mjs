import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tintLevel } from '../src/ui.js';

test('weekly diary maps 0–7 active days into five ordered tints', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(tintLevel), [0, 1, 2, 3, 3, 4, 4, 4]);
});
