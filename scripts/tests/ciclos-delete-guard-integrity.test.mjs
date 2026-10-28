import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const root = new URL('../qa/sql/', import.meta.url);
const candidate = readFileSync(new URL('ciclos-delete-guard.candidate.sql', root), 'utf8');
const check = readFileSync(new URL('ciclos-delete-guard.check.sql', root), 'utf8');

test('candidate is transactional and revokes only client cycle deletion', () => {
  assert.match(candidate, /\bBEGIN;/);
  assert.match(candidate, /\bCOMMIT;/);
  assert.match(candidate, /REVOKE DELETE ON TABLE public\.ciclos FROM authenticated;/);
  assert.doesNotMatch(candidate, /\b(?:GRANT|REVOKE|DELETE|UPDATE|INSERT|TRUNCATE)\b[^;]*\bpublic\.lancamentos\b/i);
  assert.doesNotMatch(candidate, /ALTER TABLE .* (?:DISABLE|ENABLE) ROW LEVEL SECURITY/i);
  assert.equal((candidate.match(/\bREVOKE\s+DELETE\b/g) ?? []).length, 1);
});

test('candidate checks effective permissions and aborts on regression', () => {
  assert.match(candidate, /has_table_privilege\('authenticated', 'public\.ciclos', 'DELETE'\)/);
  assert.match(candidate, /has_table_privilege\('service_role', 'public\.ciclos', 'DELETE'\)/);
  assert.match(candidate, /RAISE EXCEPTION 'DELETE still allowed/);
  assert.match(candidate, /RAISE EXCEPTION 'Legitimate read\/reopen grants were changed/);
});

test('preflight is read only and checks all four access expectations', () => {
  assert.match(check, /BEGIN TRANSACTION READ ONLY;/);
  assert.match(check, /ROLLBACK;/);
  assert.match(check, /authenticated_delete_denied/);
  assert.match(check, /authenticated_select_preserved/);
  assert.match(check, /authenticated_update_preserved/);
  assert.match(check, /service_role_maintenance_preserved/);
  assert.doesNotMatch(check, /\b(?:REVOKE|GRANT|ALTER|DROP|CREATE|INSERT|UPDATE|DELETE|TRUNCATE)\b\s+ON\b/i);
});
