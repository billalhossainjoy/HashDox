import type { Database } from '../db/client';
import { secretAuditEvents } from '../db/schema';
import { makeSecretAuditEvent, type SecretAuditInput } from './events';

/** SQL insert prepared for D1 batch; mutation and audit commit atomically. */
export function auditInsert(db: Database, input: SecretAuditInput) {
  return db.insert(secretAuditEvents).values(makeSecretAuditEvent(input));
}
