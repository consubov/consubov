const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const gate = path.resolve(__dirname, '../check-web-coverage-baseline.mjs');

function runCase({ included, floors = { statements: 4, branches: 2, functions: 3, lines: 5 }, metrics = { statements: 4.5, branches: 2.5, functions: 3.5, lines: 5.5 } }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'consubov-coverage-'));
  try {
    const web = path.join(root, 'apps', 'web');
    fs.mkdirSync(path.join(web, 'src'), { recursive: true });
    fs.mkdirSync(path.join(web, 'coverage'), { recursive: true });
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    for (const name of ['a.ts', 'b.ts']) fs.writeFileSync(path.join(web, 'src', name), 'export const value = 1;\n');
    const summary = { total: Object.fromEntries(Object.entries(metrics).map(([k,v]) => [k, { pct: v }])) };
    for (const name of included) summary[path.join(web, 'src', name)] = {};
    fs.writeFileSync(path.join(web, 'coverage', 'coverage-summary.json'), JSON.stringify(summary));
    fs.writeFileSync(path.join(root, 'scripts', 'web-coverage-baseline.json'), JSON.stringify({ floors, measuredAt: 'fixture' }));
    return spawnSync(process.execPath, [gate], { cwd: web, encoding: 'utf8' });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('rejects a coverage report that omits an actual source even when total count matches', () => {
  const run = runCase({ included: ['a.ts', 'fabricated.ts'] });
  assert.equal(run.status, 1, run.stdout + run.stderr);
  assert.match(run.stderr, /missing|ausente|incompleto/i);
});

test('accepts report covering every real source above a valid floor', () => {
  const run = runCase({ included: ['a.ts', 'b.ts'] });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});

test('rejects a missing coverage floor rather than silently weakening the gate', () => {
  const run = runCase({ included: ['a.ts', 'b.ts'], floors: { statements: 4, branches: 2, functions: 3 } });
  assert.equal(run.status, 1, run.stdout + run.stderr);
});

test('rejects coverage regression against a known floor', () => {
  const run = runCase({ included: ['a.ts', 'b.ts'], metrics: { statements: 4, branches: 2.5, functions: 3.5, lines: 5.5 } });
  assert.equal(run.status, 0, 'equal-to-floor coverage must pass');
  const regressed = runCase({ included: ['a.ts', 'b.ts'], metrics: { statements: 3, branches: 2.5, functions: 3.5, lines: 5.5 } });
  assert.equal(regressed.status, 1);
});
