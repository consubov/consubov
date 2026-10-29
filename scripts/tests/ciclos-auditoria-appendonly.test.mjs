import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const candidate = readFileSync(new URL('../qa/sql/ciclos-auditoria-appendonly.candidate.sql', import.meta.url), 'utf8');
const check = readFileSync(new URL('../qa/sql/ciclos-auditoria-appendonly.check.sql', import.meta.url), 'utf8');

test('guard is confined to isolated PG17 QA and a single scoped table', () => {
  assert.match(candidate, /^BEGIN;$/m);
  assert.match(candidate, /^COMMIT;\s*$/m);
  assert.match(candidate, /current_database\(\) !~ '\^consubov_qa_\[a-z0-9_\]\+\$'/);
  assert.match(candidate, /current_setting\('consubov\.qa_isolated_pg17', true\) IS DISTINCT FROM 'acknowledged'/);
  assert.match(candidate, /RAISE EXCEPTION 'Only explicit isolated CONSUBOV QA databases are allowed'/);
  assert.match(candidate, /to_regclass\('public\.ciclos_auditoria'\)/);
});

test('only audit UPDATE/DELETE are revoked; existing inserts are preserved', () => {
  assert.match(candidate, /^REVOKE UPDATE, DELETE ON TABLE public\.ciclos_auditoria FROM authenticated;$/m);
  assert.equal((candidate.match(/^REVOKE /gm) || []).length, 1);
  assert.doesNotMatch(candidate, /^(?:ALTER|GRANT|TRUNCATE|DROP|CREATE|UPDATE|DELETE|INSERT)\b/gm);
  assert.doesNotMatch(candidate, /\bpublic\.(?:lancamentos|ciclos)\b/);
  assert.match(candidate, /NOT has_table_privilege\('authenticated', 'public\.ciclos_auditoria', 'INSERT'\)/);
  assert.match(candidate, /NOT has_table_privilege\('authenticated', 'public\.ciclos_auditoria', 'SELECT'\)/);
});

test('postcondition rejects inherited DELETE/UPDATE and protects service maintenance', () => {
  assert.match(candidate, /has_table_privilege\('authenticated', 'public\.ciclos_auditoria', 'UPDATE'\) OR/);
  assert.match(candidate, /has_table_privilege\('authenticated', 'public\.ciclos_auditoria', 'DELETE'\)/);
  assert.match(candidate, /RAISE EXCEPTION 'Authenticated audit UPDATE\/DELETE remains allowed'/);
  assert.match(candidate, /NOT has_table_privilege\('service_role', 'public\.ciclos_auditoria', 'UPDATE'\)/);
  assert.match(candidate, /NOT has_table_privilege\('service_role', 'public\.ciclos_auditoria', 'DELETE'\)/);
  assert.match(candidate, /RAISE EXCEPTION 'Legacy read or append permission was lost'/);
});

test('preflight is read only and reports both denies and preserved permissions', () => {
  assert.match(check, /BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
  assert.match(check, /ROLLBACK;/);
  for (const name of ['authenticated_update_denied','authenticated_delete_denied','authenticated_insert_preserved','authenticated_select_preserved','service_update_preserved','service_delete_preserved']) {
    assert.ok(check.includes(name), name);
  }
  assert.doesNotMatch(check, /^(?:REVOKE|GRANT|ALTER|DROP|CREATE|INSERT|UPDATE|DELETE|TRUNCATE)\s/m);
});
