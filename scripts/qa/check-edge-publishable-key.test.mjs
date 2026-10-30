import test from 'node:test';
import assert from 'node:assert/strict';
import { getSupabasePublishableKey } from '../../supabase/functions/_shared/apiKeys.ts';

const withEnv = (variables) => (name) => variables[name];

const modern = 'sb_publishable_synthetic_not_a_real_key';
const legacy = 'legacy-jwt-synthetic-not-a-real-key';

test('prefers the modern publishable key with a default entry', () => {
  assert.equal(getSupabasePublishableKey(withEnv({
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: modern }),
    SUPABASE_ANON_KEY: legacy,
  })), modern);
});

test('uses the legacy key only when the modern environment variable is absent', () => {
  assert.equal(getSupabasePublishableKey(withEnv({ SUPABASE_ANON_KEY: legacy })), legacy);
});

test('rejects malformed modern JSON without silently falling back', () => {
  assert.throws(() => getSupabasePublishableKey(withEnv({
    SUPABASE_PUBLISHABLE_KEYS: '{broken', SUPABASE_ANON_KEY: legacy,
  })), /must be valid JSON/);
});

test('rejects a missing default entry even if another named key exists', () => {
  assert.throws(() => getSupabasePublishableKey(withEnv({
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ web: modern }),
    SUPABASE_ANON_KEY: legacy,
  })), /default/);
});

test('rejects a secret key in the public client', () => {
  assert.throws(() => getSupabasePublishableKey(withEnv({
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: 'sb_secret_synthetic' }),
  })), /not a publishable/);
});

test('rejects an array, null, and empty values for the modern key set', () => {
  for (const invalid of ['[]', 'null', '', '{}']) {
    assert.throws(() => getSupabasePublishableKey(withEnv({
      SUPABASE_PUBLISHABLE_KEYS: invalid, SUPABASE_ANON_KEY: legacy,
    })));
  }
});

test('rejects whitespace around a modern key', () => {
  assert.throws(() => getSupabasePublishableKey(withEnv({
    SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: ` ${modern}` }),
    SUPABASE_ANON_KEY: legacy,
  })), /not a publishable/);
});

test('rejects missing legacy and modern keys', () => {
  assert.throws(() => getSupabasePublishableKey(withEnv({})), /not configured/);
});
