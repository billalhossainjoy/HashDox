import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeAuditCursor, decodeAuditCursor } from '../src/audit/pagination.ts';

test('audit cursor roundtrip preserves timestamp and UUID tie breaker', () => {
  const source = { time: 1794657345000, id: '9c342aae-799b-4fb8-bf5d-221a2c018320' };
  assert.deepEqual(decodeAuditCursor(encodeAuditCursor(source)), source);
  assert.equal(decodeAuditCursor(undefined), null);
});

test('audit cursor rejects malformed or oversized inputs', () => {
  for (const token of ['', 'evil!?', 'A'.repeat(257), btoa(JSON.stringify(['1', 'x'])),
    btoa(JSON.stringify([5, '../'])), btoa(JSON.stringify([-1, 'a']))]) {
    assert.equal(decodeAuditCursor(token), undefined);
  }
});
