/** Strict event whitelist. Never accept event names or data from client payloads. */
export const SECRET_AUDIT_ACTIONS = [
  'secret.created',
  'secret.updated',
  'secret.deleted',
  'secret.moved',
  'secret.reveal_requested',
] as const;

export type SecretAuditAction = typeof SECRET_AUDIT_ACTIONS[number];

export type SecretAuditInput = {
  projectId: string;
  environmentId: string;
  secretId: string;
  action: SecretAuditAction;
};

/** No key names, secret values, ciphertext, tokens, request bodies or IP addresses. */
export function makeSecretAuditEvent(input: SecretAuditInput) {
  if (!input.projectId || !input.environmentId || !input.secretId ||
      !SECRET_AUDIT_ACTIONS.includes(input.action)) {
    throw new Error('Invalid audit event');
  }
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    environmentId: input.environmentId,
    secretId: input.secretId,
    action: input.action,
    createdAt: new Date(),
  };
}
