const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function runGate(url, outputFixture) {
  const parent = path.join(root, '.qa/fixtures/phase5-local-targets'); fs.mkdirSync(parent, { recursive: true });
  const temp = fs.mkdtempSync(path.join(parent, 'owned-'));
  const outside = fs.mkdtempSync(path.join(tmpdir(), 'consubov-local-target-'));
  const marker = path.join(temp, 'invoked');
  fs.writeFileSync(path.join(temp, 'bun'), '#!/bin/sh\nprintf "%s\\n" "$*" > "$QA_BUN_MARKER"\nexit 41\n', { mode: 0o700 });
  try {
    const output = outputFixture ? outputFixture(temp, outside) : path.join(temp, 'out');
    const run = spawnSync('bash', [path.join(root, 'scripts/run-phase5-local.sh')], { cwd: root,
      env: { ...process.env, PATH: temp + path.delimiter + process.env.PATH, VITE_SUPABASE_URL: url,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'qa-fixture-only', QA_OUTPUT_DIR: output, QA_BUN_MARKER: marker },
      encoding: 'utf8', timeout: 5000 });
    assert.ifError(run.error);
    const result = { status: run.status, stdout: run.stdout, stderr: run.stderr, invoked: fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') : null,
      outsideEntries: fs.readdirSync(outside), outputCreated: fs.existsSync(output) };
    return result;
  } finally {
    assert.equal(path.dirname(temp), parent); assert.equal(path.dirname(outside), tmpdir());
    fs.rmSync(temp, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true });
  }
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

for (const [label, setup] of [
  ['outside native path', (_owned, outside) => path.join(outside, 'INERT_OUTPUT_CANARY_3a90')],
  ['traversal outside QA', (_owned, outside) => {
    const qa = path.join(root, '.qa'), relative = path.relative(qa, outside);
    const prefix = path.isAbsolute(relative) ? outside + path.sep + 'unused' + path.sep + '..' : qa + path.sep + relative;
    assert.ok(prefix.includes('..')); return prefix + path.sep + 'INERT_OUTPUT_CANARY_3a90';
  }],
  ['nested QA junction', (owned, outside) => { const link = path.join(owned, 'alias'); fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir'); return path.join(link, 'INERT_OUTPUT_CANARY_3a90'); }],
  ['dangling QA junction', owned => { const target = path.join(owned, 'missing'), link = path.join(owned, 'alias'); fs.mkdirSync(target); fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir'); fs.rmdirSync(target); return path.join(link, 'INERT_OUTPUT_CANARY_3a90'); }],
  ['plain file ancestor', owned => { const file = path.join(owned, 'file'); fs.writeFileSync(file, 'inert fixture'); return path.join(file, 'INERT_OUTPUT_CANARY_3a90'); }],
]) test('phase5 rejects ' + label + ' before any output writes or tools', () => {
  const result = runGate('http://127.0.0.1:54321', setup);
  assert.equal(result.status, 1); assert.equal(result.invoked, null); assert.equal(result.outputCreated, false); assert.deepEqual(result.outsideEntries, []);
  assert.match(result.stderr, /plain directory inside repository \.qa/);
  assert.equal((result.stdout + result.stderr).includes('INERT_OUTPUT_CANARY_3a90'), false);
  assert.equal(result.stdout, '');
});

test('phase5 normalizes valid native output for GitBash before downstream tool', () => {
  const result = runGate('http://127.0.0.1:54321', owned => path.join(owned, 'nested', 'out'));
  assert.equal(result.status, 41); assert.equal(result.invoked, 'install --frozen-lockfile\n'); assert.equal(result.outputCreated, true);
  assert.match(result.stdout, /\[phase5\] evidence: .*\/nested\/out/); assert.equal(result.stdout.includes('\\'), false);
});
