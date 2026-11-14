import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSecretInput } from '../src/secrets/validation.ts';

test('accepts valid env-style keys and empty secret values', () => {
  assert.deepEqual(validateSecretInput({ key: '  DATABASE_URL  ', value: '' }),
    { key: 'DATABASE_URL', value: '' });
  assert.deepEqual(validateSecretInput({ key: '_A7', value: 'private' }),
    { key: '_A7', value: 'private' });
});

test('rejects unsafe keys, unexpected properties, invalid values', () => {
  for (const input of [null, [], { key: '1NO', value: 'x' },
    { key: 'WITH-DASH', value: 'x' }, { key: ' SPACE', value: 123 },
    { key: 'SAFE', value: 'x', projectId: 'other' }, { key: '', value: '' },
    { key: 'a'.repeat(129), value: 'x' }]) {
    assert.equal(validateSecretInput(input), null);
  }
});

test('limits encrypted payload to 16 KB in UTF-8', () => {
  assert.equal(validateSecretInput({ key: 'X', value: '😀'.repeat(4096) })?.key, 'X');
  assert.equal(validateSecretInput({ key: 'X', value: '😀'.repeat(4097) }), null);
});
