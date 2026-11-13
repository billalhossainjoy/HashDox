import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjectInput, parseProjectPage, PROJECT_PAGE_SIZE } from '../src/projects/validation.ts';

test('accepts and trims a valid project name', () => {
  assert.deepEqual(validateProjectInput({ name: '  Pharmacy POS  ' }), { name: 'Pharmacy POS' });
});
test('rejects blank, oversized and non-string names', () => {
  for (const name of ['', '   ', 123, null, 'x'.repeat(101)]) {
    assert.equal(validateProjectInput({ name }), null);
  }
});
test('rejects extra fields to prevent mass assignment', () => {
  assert.equal(validateProjectInput({ name: 'safe', ownerId: 'other' }), null);
  assert.equal(validateProjectInput(null), null);
  assert.equal(validateProjectInput([]), null);
});
test('pagination defaults to first page and bounds the input', () => {
  assert.equal(parseProjectPage(undefined), 1);
  assert.equal(parseProjectPage('10'), 10);
  for (const value of ['0', '-1', '1.5', '01', 'abc', '10001']) {
    assert.equal(parseProjectPage(value), null);
  }
  assert.equal(PROJECT_PAGE_SIZE, 20);
});
