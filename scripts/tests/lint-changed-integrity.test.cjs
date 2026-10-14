const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const gate = path.resolve(__dirname, '../lint-changed-web.mjs');
function run(args, cwd) { return execFileSync('git', args, { cwd, encoding: 'utf8' }); }

function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'consubov-lint-'));
  const scripts = path.join(repo, 'scripts');
  const src = path.join(repo, 'apps', 'web', 'src');
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(src, { recursive: true });
  fs.copyFileSync(gate, path.join(scripts, 'lint-changed-web.mjs'));
  fs.writeFileSync(path.join(repo, 'package.json'), '{"type":"module"}\n');
  fs.writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  const source = path.join(src, 'component.ts');
  fs.writeFileSync(source, 'export const version = 1;\n');
  run(['init', '-b', 'main'], repo);
  run(['config', 'core.autocrlf', 'false'], repo);
  run(['config', 'user.name', 'Local Test'], repo);
  run(['config', 'user.email', 'local@example.test'], repo);
  run(['add', '.'], repo);
  run(['commit', '-m', 'base'], repo);
  const eslintDir = path.join(repo, 'apps', 'web', 'node_modules', 'eslint');
  fs.mkdirSync(path.join(eslintDir, 'bin'), { recursive: true });
  const output = path.join(repo, 'lint-arguments.json');
  fs.writeFileSync(path.join(eslintDir, 'package.json'), JSON.stringify({ name: 'eslint', bin: { eslint: 'bin/eslint.js' } }));
  // Only the ESLint boundary is inert: Git discovery and the gate run unchanged.
  // A local JS CLI works without executable shims, shell quoting or network access.
  fs.writeFileSync(path.join(eslintDir, 'bin', 'eslint.js'), `
    require('node:fs').writeFileSync(process.env.AUDIT_LINT_ARGS,
      JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));
    process.exit(Number(process.env.AUDIT_LINT_EXIT || 0));
  `);
  function runGate(exit = 0) {
    return spawnSync(process.execPath, [path.join(scripts, 'lint-changed-web.mjs')], {
      cwd: path.join(repo, 'apps', 'web'), encoding: 'utf8', timeout: 10000,
      env: { ...process.env, NODE_PATH: '', AUDIT_LINT_ARGS: output, AUDIT_LINT_EXIT: String(exit) },
    });
  }
  return { repo, source, output, eslintDir, runGate, cleanup() { fs.rmSync(repo, { recursive: true, force: true }); } };
}

test('lint gate includes modified but uncommitted TypeScript files', () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.source, 'export const version = 2;\n');
    const result = f.runGate();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(fs.existsSync(f.output), 'lint was skipped for dirty file');
    assert.deepEqual(JSON.parse(fs.readFileSync(f.output, 'utf8')), {
      cwd: path.join(f.repo, 'apps', 'web'), args: [path.join('src', 'component.ts')],
    });
  } finally { f.cleanup(); }
});

test('lint gate includes a new untracked TypeScript file', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(path.dirname(f.source), 'new-file.ts'), 'export const test = true;\n');
    const result = f.runGate();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.output, 'utf8')), {
      cwd: path.join(f.repo, 'apps', 'web'), args: [path.join('src', 'new-file.ts')],
    });
  } finally { f.cleanup(); }
});

test('lint gate fails closed when installed ESLint is missing', () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.source, 'export const version = 2;\n');
    fs.rmSync(f.eslintDir, { recursive: true, force: true });
    const result = f.runGate();
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /Cannot find module 'eslint\/package\.json'/);
    assert.equal(fs.existsSync(f.output), false);
  } finally { f.cleanup(); }
});

test('lint gate preserves a nonzero exit from installed ESLint', () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.source, 'export const version = 2;\n');
    const result = f.runGate(41);
    assert.equal(result.status, 41, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(f.output, 'utf8')).args, [path.join('src', 'component.ts')]);
  } finally { f.cleanup(); }
});
