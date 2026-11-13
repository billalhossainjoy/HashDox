/** Canonical owner identity policy. Authentication is separate from authorization. */
export function isOwnerEmail(email: string | null | undefined, ownerEmail: string | null | undefined): boolean {
  const allowed = ownerEmail?.trim().toLowerCase();
  const candidate = email?.trim().toLowerCase();
  return Boolean(allowed && candidate && allowed === candidate);
}
