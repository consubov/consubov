import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ACK = 'acknowledge-local-rollback-only';
const candidate = readFileSync(
  new URL('../qa/sql/ciclos-delete-guard.candidate.sql', import.meta.url),
  'utf8',
);

function labTargetError({ ack, host, database, port }) {
  if (ack !== ACK) return 'Explicit local rollback acknowledgment missing';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) return 'Non-loopback host denied';
  if (!/^consubov_qa_[a-z0-9_]+$/.test(database)) return 'Database is not a named CONSUBOV QA database';
  if (!/^[0-9]{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    return 'Invalid PostgreSQL port';
  }
  return null;
}

function rollbackTrial(sql) {
  assert.equal((sql.match(/^REVOKE DELETE ON TABLE public\.ciclos FROM authenticated;$/gm) ?? []).length, 1);
  assert.match(sql, /\bBEGIN;/);
  assert.match(sql, /\bCOMMIT;\s*$/);
  assert.equal((sql.match(/\bCOMMIT;/g) ?? []).length, 1);
  assert.doesNotMatch(sql, /\bROLLBACK;/);

  const reversible = sql.replace(/\bCOMMIT;\s*$/, 'ROLLBACK;');
  const evidence = `
SELECT 'ACL_BEFORE|' ||
 has_table_privilege('authenticated', 'public.ciclos', 'DELETE')::text || '|' ||
 has_table_privilege('authenticated', 'public.ciclos', 'SELECT')::text || '|' ||
 has_table_privilege('authenticated', 'public.ciclos', 'UPDATE')::text || '|' ||
 has_table_privilege('service_role', 'public.ciclos', 'DELETE')::text;
SELECT set_config('consubov.qa_isolated_pg17', 'acknowledged', false);
${reversible}
SELECT 'ACL_AFTER|' ||
 has_table_privilege('authenticated', 'public.ciclos', 'DELETE')::text || '|' ||
 has_table_privilege('authenticated', 'public.ciclos', 'SELECT')::text || '|' ||
 has_table_privilege('authenticated', 'public.ciclos', 'UPDATE')::text || '|' ||
 has_table_privilege('service_role', 'public.ciclos', 'DELETE')::text;
`;
  return evidence;
}

test('requires opt-in and a local named QA database', () => {
  const local = { ack: ACK, host: '127.0.0.1', database: 'consubov_qa_ciclos', port: '5432' };
  assert.equal(labTargetError(local), null);
  assert.match(labTargetError({ ...local, ack: '' }), /acknowledgment/);
  assert.match(labTargetError({ ...local, host: 'db.production.example' }), /Non-loopback/);
  assert.match(labTargetError({ ...local, host: '192.168.1.20' }), /Non-loopback/);
  assert.match(labTargetError({ ...local, database: 'postgres' }), /named CONSUBOV QA/);
  assert.match(labTargetError({ ...local, port: '0' }), /Invalid/);
  assert.match(labTargetError({ ...local, port: '99999' }), /Invalid/);
});

test('rehearsal rolls back the original candidate, never commits it', () => {
  const rehearsal = rollbackTrial(candidate);
  assert.match(rehearsal, /REVOKE DELETE ON TABLE public\.ciclos FROM authenticated;/);
  assert.match(rehearsal, /\bROLLBACK;/);
  assert.doesNotMatch(rehearsal, /\bCOMMIT;/);
  assert.match(rehearsal, /ACL_BEFORE/);
  assert.match(rehearsal, /ACL_AFTER/);
  assert.match(rehearsal, /set_config\('consubov\.qa_isolated_pg17', 'acknowledged', false\)/);
});

test('the lab-only execution is opt-in and rollback-preserving', (t) => {
  const target = {
    ack: process.env.CONSUBOV_CICLOS_LOCAL_PG_QA ?? '',
    host: process.env.PGHOST ?? '127.0.0.1',
    database: process.env.PGDATABASE ?? '',
    port: process.env.PGPORT ?? '5432',
  };
  if (target.ack !== ACK) return t.skip('Local PostgreSQL QA not explicitly requested');
  const unsafe = labTargetError(target);
  assert.equal(unsafe, null, unsafe ?? '');

  // Isolated DB can still be a tunnel; operator must verify its actual identity.
  const result = spawnSync('psql', [
    '-X', '--no-password', '-v', 'ON_ERROR_STOP=1', '-qAt',
    '-h', target.host, '-p', target.port, '-d', target.database,
  ], {
    input: rollbackTrial(candidate),
    encoding: 'utf8',
    timeout: 20_000,
    maxBuffer: 64 * 1024,
    env: { ...process.env, PGCONNECT_TIMEOUT: '4', PGHOST: target.host, PGDATABASE: target.database, PGPORT: target.port },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || 'psql failed');
  const before = result.stdout.match(/^ACL_BEFORE\|(.+)$/m)?.[1];
  const after = result.stdout.match(/^ACL_AFTER\|(.+)$/m)?.[1];
  assert.equal(before, 'true|true|true|true', 'Expected local database privileges differ');
  assert.equal(after, before, 'ACL was not restored after the rollback rehearsal');
});
