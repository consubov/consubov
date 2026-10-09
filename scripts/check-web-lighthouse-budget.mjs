import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const budgetPath = process.env.LIGHTHOUSE_BUDGET_PATH ?? path.join(repoRoot, 'scripts/web-lighthouse-budget.json');
const outputDir = process.env.QA_OUTPUT_DIR;
const fail = (message) => { console.error('[lighthouse:budget] FAIL:', message); process.exitCode = 1; };

if (!outputDir || !fs.existsSync(outputDir)) {
  fail('QA_OUTPUT_DIR must point to an existing directory containing local Lighthouse JSON reports.');
} else {
  let budget;
  try { budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8')); }
  catch { fail('Missing or invalid budget JSON: ' + budgetPath); }
  if (budget === null || typeof budget !== 'object' || Array.isArray(budget)) {
    fail('Budget must be a non-null JSON object with an approved measured baseline.');
  } else {
    if (budget.status !== 'APPROVED_BASELINE' || !/^[a-f0-9]{40}$/i.test(budget.baselineCommit ?? '')) {
      fail('Measured and approved local baseline required; do not invent thresholds.');
    } else {
      const required = { minimum: ['performance', 'accessibility'], maximum: ['lcpMs', 'cls', 'tbtMs'] };
      for (const page of ['home', 'login']) {
        const rule = budget.pages?.[page];
        if (!rule || Object.entries(required).some(([bound, metrics]) => metrics.some((metric) => !Object.hasOwn(rule[bound] ?? {}, metric)))) {
          fail('Missing mandatory metrics for ' + page);
          continue;
        }
        let report;
        try { report = JSON.parse(fs.readFileSync(path.join(outputDir, 'lighthouse-' + page + '.json'), 'utf8')); }
        catch { fail('Missing Lighthouse report for ' + page); continue; }
        const metrics = {
          performance: report.categories?.performance?.score,
          accessibility: report.categories?.accessibility?.score,
          lcpMs: report.audits?.['largest-contentful-paint']?.numericValue,
          cls: report.audits?.['cumulative-layout-shift']?.numericValue,
          tbtMs: report.audits?.['total-blocking-time']?.numericValue,
        };
        for (const [bound, op] of [['minimum', 'min'], ['maximum', 'max']]) {
          for (const [key, limit] of Object.entries(rule?.[bound] ?? {})) {
            const measured = metrics[key];
            if (!Number.isFinite(limit) || !Number.isFinite(measured)) {
              fail(page + '.' + key + ' lacks a finite measured value or budget.');
            } else if ((op === 'min' && measured < limit) || (op === 'max' && measured > limit)) {
              fail(page + '.' + key + ': ' + measured + ' outside ' + bound + ' ' + limit);
            } else {
              console.log('[lighthouse:budget] PASS', page + '.' + key, measured, bound, limit);
            }
          }
        }
      }
    }
  }
}
