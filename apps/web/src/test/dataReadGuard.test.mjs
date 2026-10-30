import assert from 'node:assert/strict';
import test from 'node:test';
import { requireReadRows, requireReadValue, DataReadFailure, dataReadErrorMessage } from '../lib/dataReadGuard.ts';

test('legitimate empty rows remain an empty result', () => {
  assert.deepEqual(requireReadRows({ data: [], error: null, status: 200 }), []);
});
test('nonempty rows preserved without widening access', () => {
  const values = [{ id: 'farm-a' }];
  assert.equal(requireReadRows({ data: values, error: null }), values);
});
test('401/403/42501 deny, never fabricate empty rows', () => {
  for (const [status, code] of [[401, 'PGRST301'], [403, 'XYZ'], [400, '42501']]) {
    assert.throws(() => requireReadRows({ data: null, error: { code }, status }), e => e instanceof DataReadFailure && e.kind === 'permission');
  }
});
test('other transport errors cannot turn into zero or cached []', () => {
  assert.throws(() => requireReadRows({ data: null, error: { code: 'PGRST000' }, status: 503 }), e => e instanceof DataReadFailure && e.kind === 'unavailable');
});
test('invalid 200 null is not valid empty list', () => {
  assert.throws(() => requireReadRows({ data: null, error: null, status: 200 }), e => e instanceof DataReadFailure && e.kind === 'invalid_response');
});
test('read records require actual row', () => {
  assert.equal(requireReadValue({ data: { id: 'a' }, error: null }).id, 'a');
  assert.throws(() => requireReadValue({ data: null, error: null }), DataReadFailure);
});
test('messages hide raw backend errors', () => {
  const raw = new Error('token secret PII');
  assert.ok(!dataReadErrorMessage(raw).includes('secret'));
  assert.match(dataReadErrorMessage(new DataReadFailure('permission')), /sessão/i);
});
