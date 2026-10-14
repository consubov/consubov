import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sourceState } from './qa/source-state.mjs';
import { validateLighthouseReport } from './qa/run-lighthouse-local.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireWeb = createRequire(path.join(repoRoot, 'apps/web/package.json'));
const budgetPath = process.env.LIGHTHOUSE_BUDGET_PATH ?? path.join(repoRoot, 'scripts/web-lighthouse-budget.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const within = (value, root) => { const rel = path.relative(root, value); return !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep); };
const insist = (condition, message) => { if (!condition) throw new Error(message); };
function plainPath(value, kind, boundary) {
  const full = path.resolve(value);
  if (boundary) insist(within(full, boundary), 'Lighthouse evidence path leaves output root');
  const start = within(full, repoRoot) ? repoRoot : path.parse(full).root;
  let current = start;
  for (const part of path.relative(start, full).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = fs.lstatSync(current);
    insist(!info.isSymbolicLink(), 'Lighthouse evidence symlink ancestor refused');
    if (current !== full) insist(info.isDirectory(), 'Lighthouse evidence ancestor is not a directory');
  }
  const info = fs.lstatSync(full);
  insist(kind === 'directory' ? info.isDirectory() : info.isFile(), 'Lighthouse evidence is not a plain ' + kind);
  if (boundary) insist(within(fs.realpathSync(full), fs.realpathSync(boundary)), 'Lighthouse evidence canonical path leaves output root');
  return full;
}
function bytes(value, boundary, max = 1024 * 1024) {
  const full = plainPath(value, 'file', boundary);
  insist(fs.statSync(full).size <= max, 'Lighthouse evidence exceeds read bound');
  const data = fs.readFileSync(full);
  insist(data.length <= max, 'Lighthouse evidence exceeds read bound');
  return data;
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
const required = { minimum: ['performance', 'accessibility'], maximum: ['lcpMs', 'cls', 'tbtMs'] };
function domain(key, value) { return Number.isFinite(value) && value >= 0 && (!['performance', 'accessibility'].includes(key) || value <= 1); }

try {
  const budget = JSON.parse(bytes(budgetPath));
  insist(object(budget), 'Budget must be a non-null JSON object with an approved measured baseline');
  insist(budget.status === 'APPROVED_BASELINE' && /^[a-f0-9]{40}$/i.test(budget.baselineCommit ?? ''), 'Measured and approved local baseline required; do not invent thresholds');
  for (const page of ['home', 'login']) {
    const rule = budget.pages?.[page];
    insist(object(rule), 'Missing mandatory metrics for ' + page);
    for (const [bound, keys] of Object.entries(required)) {
      insist(object(rule[bound]) && keys.every(key => Object.hasOwn(rule[bound], key)), 'Missing mandatory metrics for ' + page);
      for (const [key, limit] of Object.entries(rule[bound])) insist(['performance', 'accessibility', 'lcpMs', 'cls', 'tbtMs'].includes(key) && domain(key, limit), 'Invalid numeric budget for ' + page);
    }
  }
  insist(typeof process.env.QA_OUTPUT_DIR === 'string' && process.env.QA_OUTPUT_DIR, 'QA_OUTPUT_DIR must contain complete local Lighthouse evidence');
  const output = plainPath(process.env.QA_OUTPUT_DIR, 'directory');
  const sessions = fs.readdirSync(output).filter(name => name.startsWith('lighthouse-session-'));
  insist(sessions.length === 1, 'Exactly one unambiguous Lighthouse session is required');
  const name = sessions[0];
  insist(/^lighthouse-session-[a-z0-9]+$/i.test(name), 'Invalid Lighthouse session name');
  const session = plainPath(path.join(output, name), 'directory', output);
  const measured = JSON.parse(bytes(path.join(session, 'measurements.json'), output));
  insist(object(measured) && measured.status === 'MEASURED' && measured.applicationAcceptance === false, 'Complete measured Lighthouse manifest required');
  const version = requireWeb('lighthouse/package.json').version;
  insist(version === '13.5.0' && measured.lighthouseVersion === version && measured.playwrightVersion === requireWeb('@playwright/test/package.json').version, 'Lighthouse tool protocol version mismatch');
  const initial = measured.sourceAtStart, final = measured.sourceAtFinish, current = sourceState(repoRoot);
  for (const state of [initial, final, current]) {
    insist(object(state) && /^[a-f0-9]{40}$/i.test(state.commit ?? '') && /^[a-f0-9]{64}$/i.test(state.fingerprint ?? '') && typeof state.workingTreeDirty === 'boolean' && typeof state.branch === 'string', 'Missing real source witness');
  }
  insist(isDeepStrictEqual(initial, final) && isDeepStrictEqual(initial, current), 'Lighthouse source changed, is stale, or has dishonest dirty metadata');
  let base;
  try { base = new URL(measured.baseURL); } catch { throw new Error('Invalid Lighthouse local origin'); }
  insist(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) && !base.username && !base.password && base.pathname === '/' && !base.search && !base.hash, 'Invalid Lighthouse local origin');
  insist(Array.isArray(measured.runs) && measured.runs.length === 6, 'Exactly three cold home/login pairs required');
  const { defaultSettings } = await import(pathToFileURL(path.join(path.dirname(requireWeb.resolve('lighthouse/package.json')), 'core/config/constants.js')));
  const seen = new Set(), originals = new Map(), allMetrics = [];
  for (const run of measured.runs) {
    insist(object(run) && ['home', 'login'].includes(run.page) && Number.isInteger(run.index) && run.index >= 1 && run.index <= 3, 'Invalid cold run index or page');
    const key = run.page + run.index;
    insist(!seen.has(key), 'Duplicate Lighthouse run'); seen.add(key);
    insist(typeof run.report === 'string' && !path.isAbsolute(run.report) && !/^[a-z]:/i.test(run.report), 'Invalid Lighthouse report path');
    const parts = run.report.split(/[\\/]/);
    insist(parts.length === 3 && parts[0] === name && parts[1] === 'run-' + run.index && parts[2] === 'lighthouse-' + run.page + '.json', 'Traversal or inconsistent Lighthouse report path');
    const original = bytes(path.join(output, ...parts), output, 64 * 1024 * 1024);
    insist(/^[a-f0-9]{64}$/i.test(run.reportSha256 ?? '') && sha(original) === run.reportSha256.toLowerCase(), 'Original Lighthouse report hash mismatch');
    const report = JSON.parse(original);
    const metrics = validateLighthouseReport(report, new URL(run.page === 'home' ? '/' : '/login', base).href, version);
    for (const setting of ['formFactor', 'throttlingMethod', 'disableStorageReset', 'screenEmulation', 'throttling', 'emulatedUserAgent', 'onlyAudits', 'onlyCategories', 'skipAudits', 'extraHeaders']) {
      insist(isDeepStrictEqual(report.configSettings[setting], defaultSettings[setting]), 'Lighthouse cold mobile protocol settings changed');
    }
    insist(isDeepStrictEqual(run.metrics, metrics) && isDeepStrictEqual(run.settings, report.configSettings), 'Lighthouse recorded readouts differ from originals');
    insist(typeof run.browserVersion === 'string' && /^\w*Chrome\/\d+\.\d+\.\d+\.\d+$/.test(run.browserVersion) && run.profileMarkerVerified === true, 'Missing own cold Chrome provenance');
    insist(object(run.network) && Number.isInteger(run.network.allowed) && run.network.allowed > 0 && ['errors', 'timeouts', 'oversized'].every(key => run.network[key] === 0), 'Lighthouse allowed-origin network failed');
    originals.set(key, original); allMetrics.push({ ...run, metrics });
  }
  for (const page of ['home', 'login']) {
    const canonical = bytes(path.join(output, 'lighthouse-' + page + '.json'), output, 64 * 1024 * 1024);
    insist(canonical.equals(originals.get(page + '1')), 'Canonical Lighthouse report is not the unchanged first cold original');
    for (const metric of ['performance', 'accessibility', 'lcpMs', 'cls', 'tbtMs']) {
      const values = allMetrics.filter(run => run.page === page).map(run => run.metrics[metric]).sort((a, b) => a - b);
      insist(isDeepStrictEqual(measured.summary?.[page]?.[metric], { min: values[0], median: values[1], max: values[2], values }), 'Lighthouse summary readouts differ from all originals');
    }
  }
  let regressed = false;
  for (const run of allMetrics) for (const [bound, limits] of Object.entries(budget.pages[run.page])) {
    if (!['minimum', 'maximum'].includes(bound)) continue;
    for (const [key, limit] of Object.entries(limits)) {
      const value = run.metrics[key];
      if ((bound === 'minimum' && value < limit) || (bound === 'maximum' && value > limit)) {
        regressed = true; console.error('[lighthouse:budget] FAIL', run.page, 'run' + run.index, key, value, bound, limit);
      }
    }
  }
  insist(!regressed, 'At least one of six measured Lighthouse reports regressed');
  console.log('[lighthouse:budget] PASS: all6 originals match source/protocol/hashes and unchanged limits');
} catch {
  // Never print untrusted path, URL, JSON parse context or report contents.
  console.error('[lighthouse:budget] FAIL: Missing, invalid, or regressing complete local evidence');
  process.exitCode = 1;
}
