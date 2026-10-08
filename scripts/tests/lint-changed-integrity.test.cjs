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
  const source = path.join(src, 'component.ts');
  fs.writeFileSync(source, 'export const version = 1;\n');
  run(['init', '-b', 'main'], repo);
  run(['config', 'user.name', 'Local Test'], repo);
  run(['config', 'user.email', 'local@example.test'], repo);
  run(['add', '.'], repo);
  run(['commit', '-m', 'base'], repo);
  const toolsDir = path.join(repo, 'tools');
  fs.mkdirSync(toolsDir);
  const output = path.join(repo, 'lint-arguments.json');
  const stub = path.join(toolsDir, 'bunx');
  fs.writeFileSync(stub, '#!/bin/sh\nprintf "%s\\n" "$@" > "$AUDIT_LINT_ARGS"\n');
  fs.chmodSync(stub, 0o755);
  function runGate() {
    return spawnSync(process.execPath, [path.join(scripts, 'lint-changed-web.mjs')], {
      cwd: path.join(repo, 'apps', 'web'), encoding: 'utf8',
      env: { ...process.env, PATH: toolsDir + path.delimiter + process.env.PATH, AUDIT_LINT_ARGS: output },
    });
  }
  return { repo, source, output, runGate, cleanup() { fs.rmSync(repo, { recursive: true, force: true }); } };
}

test('lint gate includes modified but uncommitted TypeScript files', () => {
  const f = fixture();
  try {
    fs.writeFileSync(f.source, 'export const version = 2;\n');
    const result = f.runGate();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.ok(fs.existsSync(f.output), 'lint was skipped for dirty file');
    assert.match(fs.readFileSync(f.output, 'utf8'), /src\/component\.ts/);
  } finally { f.cleanup(); }
});

test('lint gate includes a new untracked TypeScript file', () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(path.dirname(f.source), 'new-file.ts'), 'export const test = true;\n');
    const result = f.runGate();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(fs.readFileSync(f.output, 'utf8'), /src\/new-file\.ts/);
  } finally { f.cleanup(); }
});
