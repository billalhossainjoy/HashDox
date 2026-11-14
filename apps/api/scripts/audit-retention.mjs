/**
 * Offline retention helper. Dry run is default; no destructive action unless
 * explicitly invoked with --apply and --days N. This script works only with
 * local D1 unless manually changed and reviewed.
 */
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const dayAt = args.indexOf('--days');
const days = dayAt >= 0 ? Number(args[dayAt + 1]) : 365;
if (!Number.isSafeInteger(days) || days < 30 || days > 3650 ||
    args.some(arg => !['--apply', '--days', String(days)].includes(arg))) {
  console.error('Usage: node scripts/audit-retention.mjs [--days 365] [--apply]');
  process.exit(2);
}

const cutoff = Date.now() - days * 86400000;
const sql = apply
  ? `DELETE FROM secret_audit_events WHERE created_at < ${cutoff}`
  : `SELECT COUNT(*) AS eligible FROM secret_audit_events WHERE created_at < ${cutoff}`;
console.log(`Audit retention: ${days} days, cutoff ${new Date(cutoff).toISOString()}, mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
if (apply) console.log('Warning: local audit records will be permanently deleted.');
const result = spawnSync('pnpm',
  ['exec', 'wrangler', 'd1', 'execute', 'DB', '--local', '--command', sql],
  { cwd: process.cwd(), stdio: 'inherit' });
process.exit(result.status ?? 1);
