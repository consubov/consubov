const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'scripts/run-phase5-local.sh'), 'utf8');
test('phase5 uses the installed Playwright Axe runner instead of downloading Selenium', () => {
  assert.doesNotMatch(source, /bunx\s+@axe-core\/cli/);
  assert.match(source, /node\s+\.\.\/\.\.\/scripts\/qa\/run-a11y-local\.mjs/);
});
test('Lighthouse resolves the installed Playwright Chromium executable', () => {
  assert.match(source, /export CHROME_PATH=.*chromium\.executablePath/);
});
test('preview fails on a busy port rather than auditing an unrelated server', () => {
  assert.match(source, /preview[^\n]*--strictPort/);
});
test('pending performance approval cannot prevent independent Edge and HTTP checks', () => {
  const budget = source.indexOf('node scripts/check-web-lighthouse-budget.mjs');
  assert.ok(budget > source.indexOf('unset API_PID'), 'check the budget after independent API/Edge tests');
  assert.ok(budget < source.indexOf('echo "[phase5] PASS"'), 'pending baseline must still fail the phase');
});
test('phase5 pins the accessibility target to its own local preview', () => {
  assert.match(source, /QA_BASE_URL=http:\/\/127\.0\.0\.1:8080 node/);
});
