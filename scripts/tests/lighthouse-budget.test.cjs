const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const checker = path.join(root, 'scripts/check-web-lighthouse-budget.mjs');
const requireWeb = createRequire(path.join(root, 'apps/web/package.json'));
const version = requireWeb('lighthouse/package.json').version;
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const approved = {
  status: 'APPROVED_BASELINE', baselineCommit: 'a'.repeat(40),
  pages: { home: { minimum: { performance: 0.8, accessibility: 0.9 }, maximum: { lcpMs: 2500, cls: 0.1, tbtMs: 300 } },
    login: { minimum: { performance: 0.8, accessibility: 0.9 }, maximum: { lcpMs: 2500, cls: 0.1, tbtMs: 300 } } },
};
const metricView = report => ({ performance: report.categories.performance.score, accessibility: report.categories.accessibility.score,
  lcpMs: report.audits['largest-contentful-paint'].numericValue, cls: report.audits['cumulative-layout-shift'].numericValue, tbtMs: report.audits['total-blocking-time'].numericValue });
async function withReports(action) {
  const parent = path.join(root, '.qa/fixtures/lighthouse-budget'); fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, 'unit-'));
  const sessionName = 'lighthouse-session-test01'; const session = path.join(dir, sessionName); fs.mkdirSync(session);
  const metadataPath = path.join(session, 'measurements.json'); const budgetPath = path.join(dir, 'budget.json');
  const { sourceState } = await import('../qa/source-state.mjs');
  const { defaultSettings } = await import(pathToFileURL(path.join(path.dirname(requireWeb.resolve('lighthouse/package.json')), 'core/config/constants.js')));
  const source = sourceState(root); assert.ok(source.fingerprint, 'unit fixtures must use actual local source evidence');
  // Complete SYNTHETIC UNIT contracts; these values never approve application measurements.
  const metadata = { kind: 'UNIT_FIXTURE_ONLY', status: 'MEASURED', applicationAcceptance: false, baseURL: 'http://127.0.0.1:8080',
    lighthouseVersion: version, playwrightVersion: requireWeb('@playwright/test/package.json').version, sourceAtStart: source, sourceAtFinish: { ...source }, runs: [], summary: {} };
  const reports = new Map();
  for (let index = 1; index <= 3; index++) for (const page of ['home', 'login']) {
    const url = metadata.baseURL + (page === 'home' ? '/' : '/login');
    const report = { lighthouseVersion: version, requestedUrl: url, mainDocumentUrl: url, finalDisplayedUrl: url, configSettings: structuredClone(defaultSettings),
      environment: { hostUserAgent: 'UNIT_FIXTURE_ONLY HeadlessChrome/156.0.0.0', benchmarkIndex: 1000 }, runWarnings: [],
      categories: { performance: { score: 0.82 }, accessibility: { score: 0.95 } },
      audits: { 'largest-contentful-paint': { numericValue: 2100 }, 'cumulative-layout-shift': { numericValue: 0.08 }, 'total-blocking-time': { numericValue: 250 } } };
    const rel = path.join(sessionName, 'run-' + index, 'lighthouse-' + page + '.json');
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    const body = json(report); fs.writeFileSync(path.join(dir, rel), body);
    if (index === 1) fs.writeFileSync(path.join(dir, 'lighthouse-' + page + '.json'), body);
    reports.set(page + index, report);
    metadata.runs.push({ page, index, report: rel, reportSha256: hash(body), metrics: metricView(report), settings: report.configSettings,
      browserVersion: 'Chrome/156.0.8078.4', profileMarkerVerified: true, network: { allowed: 1, deniedHttp: 0, deniedConnect: 0, peerResets: 0, errors: 0, timeouts: 0, oversized: 0 } });
  }
  function updateReport(page, index, mutate) {
    const report = reports.get(page + index); mutate(report);
    const run = metadata.runs.find(item => item.page === page && item.index === index); const body = json(report);
    fs.writeFileSync(path.join(dir, run.report), body); run.reportSha256 = hash(body); run.metrics = metricView(report); run.settings = report.configSettings;
    if (index === 1) fs.writeFileSync(path.join(dir, 'lighthouse-' + page + '.json'), body);
  }
  function execute(budget = approved, beforeChecker) {
    for (const page of ['home', 'login']) {
      metadata.summary[page] = {};
      for (const metric of Object.keys(metadata.runs.find(run => run.page === page).metrics)) {
        const values = metadata.runs.filter(run => run.page === page).map(run => run.metrics[metric]).sort((a, b) => a - b);
        metadata.summary[page][metric] = { min: values[0], median: values[Math.floor(values.length / 2)], max: values.at(-1), values };
      }
    }
    fs.writeFileSync(metadataPath, json(metadata)); fs.writeFileSync(budgetPath, json(budget));
    if (beforeChecker) beforeChecker();
    const result = spawnSync(process.execPath, [checker], { cwd: root, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, QA_OUTPUT_DIR: dir, LIGHTHOUSE_BUDGET_PATH: budgetPath } });
    assert.ifError(result.error); return result;
  }
  try { return await action({ execute, dir, metadata, metadataPath, updateReport }); }
  finally { assert.equal(path.dirname(dir), parent); fs.rmSync(dir, { recursive: true, force: true }); }
}
const fails = result => assert.notEqual(result.status, 0, result.stdout + result.stderr);
test('unmeasured Lighthouse baseline cannot silently pass', () => withReports(({ execute }) => fails(execute({ ...approved, status: 'PENDING_LOCAL_BASELINE', baselineCommit: null }))));
test('approved complete six-run unit contracts inside limits pass (not app acceptance)', () => withReports(({ execute }) => { const result = execute(); assert.equal(result.status, 0, result.stderr); }));
test('regressing a threshold fails the gate', () => withReports(({ execute }) => fails(execute({ ...approved, pages: { ...approved.pages, home: { ...approved.pages.home, minimum: { performance: 0.9 } } } }))));
test('null threshold fails instead of disabling the gate', () => withReports(({ execute }) => fails(execute({ ...approved, pages: { ...approved.pages, login: { ...approved.pages.login, maximum: { lcpMs: null } } } }))));
test('approved status with no page rules fails', () => withReports(({ execute }) => fails(execute({ ...approved, pages: {} }))));
test('baseline must identify a real commit format', () => withReports(({ execute }) => fails(execute({ ...approved, baselineCommit: 'unknown' }))));
for (const value of [null, false]) test('literal ' + value + ' budget fails closed', () => withReports(({ execute }) => fails(execute(value))));
test('later regression cannot hide behind the passing canonical first pair', () => withReports(({ execute, updateReport }) => { updateReport('home', 3, report => { report.categories.performance.score = 0.2; }); fails(execute()); }));
test('partial two-run evidence cannot satisfy three cold pairs', () => withReports(({ execute, metadata }) => { metadata.runs.splice(2); fails(execute()); }));
test('duplicate index/page evidence fails', () => withReports(({ execute, metadata }) => { metadata.runs[5] = { ...metadata.runs[1] }; fails(execute()); }));
test('ambiguous manifests fail', () => withReports(({ execute, dir, metadata }) => { const other = path.join(dir, 'lighthouse-session-abc123'); fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'measurements.json'), json(metadata)); fails(execute()); }));
test('corrupt original hash fails before trusting metrics', () => withReports(({ execute, dir, metadata }) => { fs.appendFileSync(path.join(dir, metadata.runs[4].report), ' '); fails(execute()); }));
test('traversal report path fails', () => withReports(({ execute, metadata }) => { metadata.runs[4].report = '../outside.json'; fails(execute()); }));
test('linked metadata session fails without following its target', () => withReports(({ execute, dir, metadata }) => { const session = path.dirname(path.join(dir, metadata.runs[0].report, '..')); const outside = path.join(dir, 'unit-linked-target'); fs.renameSync(session, outside); fs.symlinkSync(outside, session, process.platform === 'win32' ? 'junction' : 'dir'); fails(execute()); }));
test('canonical median substitution fails even if all metrics are within limits', () => withReports(({ execute, dir, metadata, updateReport }) => { updateReport('home', 2, report => { report.categories.performance.score = 0.83; }); fs.copyFileSync(path.join(dir, metadata.runs[2].report), path.join(dir, 'lighthouse-home.json')); fails(execute()); }));
test('stable-looking old fingerprint cannot pass as current source', () => withReports(({ execute, metadata }) => { metadata.sourceAtStart.fingerprint = '0'.repeat(64); metadata.sourceAtFinish.fingerprint = '0'.repeat(64); fails(execute()); }));
test('source drift and dishonest dirty metadata fail', () => withReports(({ execute, metadata }) => { metadata.sourceAtFinish.fingerprint = '0'.repeat(64); metadata.sourceAtStart.workingTreeDirty = !metadata.sourceAtStart.workingTreeDirty; fails(execute()); }));
for (const [label, mutate] of [
  ['runtimeError', report => { report.runtimeError = { code: 'UNIT_ERROR' }; }],
  ['wrong origin', report => { report.finalDisplayedUrl = 'https://example.invalid/'; }],
  ['string score', report => { report.categories.performance.score = '0.82'; }],
  ['out-of-range score', report => { report.categories.accessibility.score = 1.5; }],
  ['negative timing', report => { report.audits['largest-contentful-paint'].numericValue = -1; }],
  ['null timing', report => { report.audits['total-blocking-time'].numericValue = null; }],
  ['warm settings', report => { report.configSettings.disableStorageReset = true; }],
]) test('later malformed original fails: ' + label, () => withReports(({ execute, updateReport }) => { updateReport('login', 3, mutate); fails(execute()); }));

test('equality at every limit passes for all six original reports', () => withReports(({ execute }) => {
  const equal = structuredClone(approved);
  for (const page of ['home', 'login']) equal.pages[page] = { minimum: { performance: 0.82, accessibility: 0.95 }, maximum: { lcpMs: 2100, cls: 0.08, tbtMs: 250 } };
  const result = execute(equal); assert.equal(result.status, 0, result.stderr);
}));
test('missing manifest fails without legacy first-pair fallback', () => withReports(({ execute, metadataPath }) => fails(execute(approved, () => fs.unlinkSync(metadataPath)))));
test('missing later original fails', () => withReports(({ execute, metadata, dir }) => { fs.unlinkSync(path.join(dir, metadata.runs[5].report)); fails(execute()); }));
test('string numeric limit fails', () => withReports(({ execute }) => { const bad = structuredClone(approved); bad.pages.home.minimum.performance = '0.8'; fails(execute(bad)); }));
test('negative budget limit fails', () => withReports(({ execute }) => { const bad = structuredClone(approved); bad.pages.home.minimum.performance = -1; fails(execute(bad)); }));
test('manifest metric readouts cannot override the original', () => withReports(({ execute, metadata }) => { metadata.runs[4].metrics.lcpMs = 1; fails(execute()); }));
test('summary cannot substitute synthetic better values', () => withReports(({ execute, metadataPath }) => fails(execute(approved, () => { const body = JSON.parse(fs.readFileSync(metadataPath)); body.summary.home.performance.median = 0.4; fs.writeFileSync(metadataPath, json(body)); }))));
test('allowed origin network errors fail measurement evidence', () => withReports(({ execute, metadata }) => { metadata.runs[3].network.errors = 1; fails(execute()); }));
test('unthrottled later run cannot masquerade as the same cold protocol', () => withReports(({ execute, updateReport }) => { updateReport('home', 2, report => { report.configSettings.throttling.cpuSlowdownMultiplier = 1; }); fails(execute()); }));

for (const artifact of ['budget', 'manifest', 'original']) test('malformed ' + artifact + ' fails without printing inert artifact canary', () => withReports(({ execute, dir, metadataPath, metadata }) => {
  const canary = 'INERT_UNIT_ARTIFACT_CANARY_7ac11';
  const result = execute(approved, () => {
    const target = artifact === 'budget' ? path.join(dir, 'budget.json') : artifact === 'manifest' ? metadataPath : path.join(dir, metadata.runs[5].report);
    const malformed = '{"unit":"' + canary + '" INVALID';
    fs.writeFileSync(target, malformed);
    if (artifact === 'original') {
      const stored = JSON.parse(fs.readFileSync(metadataPath)); stored.runs[5].reportSha256 = hash(malformed); fs.writeFileSync(metadataPath, json(stored));
    }
  });
  fails(result); assert.ok(!(result.stdout + result.stderr).includes(canary), 'untrusted artifact canary must stay out of checker output');
}));
