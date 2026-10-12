const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function runGate(url) {
  const temp = fs.mkdtempSync(path.join(tmpdir(), 'consubov-local-target-'));
  const marker = path.join(temp, 'invoked');
  fs.writeFileSync(path.join(temp, 'bun'), '#!/bin/sh\nprintf "%s\\n" "$*" > "$QA_BUN_MARKER"\nexit 41\n', { mode: 0o700 });
  try {
    const run = spawnSync('bash', [path.join(root, 'scripts/run-phase5-local.sh')], { cwd: root,
      env: { ...process.env, PATH: temp + path.delimiter + process.env.PATH, VITE_SUPABASE_URL: url,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'qa-fixture-only', QA_OUTPUT_DIR: path.join(temp, 'out'), QA_BUN_MARKER: marker },
      encoding: 'utf8', timeout: 5000 });
    assert.ifError(run.error);
    return { status: run.status, stderr: run.stderr, invoked: fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : null };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}
for (const url of ['https://example.invalid', 'http://127.0.0.1.attacker.invalid', 'http://user:pass@127.0.0.1:54321', 'http://127.0.0.1:54321/rest/v1', 'http://127.0.0.1:54321/?token=fixture', 'file:///tmp/fixture']) {
  test('phase5 refuses unsafe backend before tools: ' + url, () => {
    const result = runGate(url);
    assert.equal(result.status, 1);
    assert.equal(result.invoked, null);
    assert.match(result.stderr, /local HTTP origin/i);
  });
}
test('phase5 permits loopback with an inert package-tool sentinel', () => {
  const result = runGate('http://127.0.0.1:54321');
  assert.equal(result.status, 41);
  assert.equal(result.invoked, 'install --frozen-lockfile\n');
});
