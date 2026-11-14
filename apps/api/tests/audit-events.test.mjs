import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSecretAuditEvent, SECRET_AUDIT_ACTIONS } from '../src/audit/events.ts';

test('audit event never records secret values or names', () => {
  for (const action of SECRET_AUDIT_ACTIONS) {
    const event = makeSecretAuditEvent({
      projectId: 'p', environmentId: 'e', secretId: 's', action,
      key: 'PRIVATE_NAME', value: 'PRIVATE_VALUE', ciphertext: 'PRIVATE_CIPHERTEXT',
    });
    assert.deepEqual(Object.keys(event).sort(),
      ['action', 'createdAt', 'environmentId', 'id', 'projectId', 'secretId']);
    assert.equal(JSON.stringify(event).includes('PRIVATE'), false);
  }
});

test('audit events validate identity and action', () => {
  assert.throws(() => makeSecretAuditEvent({
    projectId: '', environmentId: 'e', secretId: 's', action: 'secret.created',
  }));
  assert.throws(() => makeSecretAuditEvent({
    projectId: 'p', environmentId: 'e', secretId: 's', action: 'other',
  }));
});
