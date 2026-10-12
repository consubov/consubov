import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const requireWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = requireWeb('@playwright/test');
const { default: AxeBuilder } = requireWeb('@axe-core/playwright');
const pages = ['/', '/login', '/recuperar-senha'];

/** Audit the built public app with locked dependencies; never contact production. */
export async function auditLocalAccessibility({ baseURL = 'http://127.0.0.1:8080', outputDir, timeout = 30000 } = {}) {
  const origin = new URL(baseURL);
  if (origin.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Accessibility QA requires a local HTTP origin without credentials');
  }
  if (!outputDir) throw new Error('QA_OUTPUT_DIR is required for accessibility evidence');
  await mkdir(outputDir, { recursive: true });
  const report = { status: 'FAIL', baseURL: origin.origin, browser: null, pages: [], error: null };
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    report.browser = browser.version();
    for (const path of pages) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
      const result = { path, title: null, violations: [], incomplete: [], pageErrors: [], error: null };
      try {
        // Local fixtures only: no external API, fonts, analytics or customer data.
        await context.route('**/*', route => new URL(route.request().url()).origin === origin.origin ? route.continue() : route.abort('blockedbyclient'));
        const page = await context.newPage();
        page.setDefaultTimeout(timeout);
        page.on('pageerror', error => result.pageErrors.push(error.message));
        const response = await page.goto(new URL(path, origin).href, { waitUntil: 'load', timeout });
        if (!response?.ok() || new URL(page.url()).pathname !== path) throw new Error('Unexpected HTTP response or route redirect');
        // Do not report an empty/loading shell as an accessible application.
        await page.locator('h1, h2, form').first().waitFor({ state: 'visible' });
        result.title = await page.title();
        if (!result.title.trim()) throw new Error('Missing page title');
        const analysis = await new AxeBuilder({ page }).analyze();
        const summarize = issue => ({ id: issue.id, impact: issue.impact, help: issue.help, targets: issue.nodes.map(node => node.target) });
        result.violations = analysis.violations.map(summarize);
        result.incomplete = analysis.incomplete.map(summarize);
      } catch (error) {
        result.error = error.message;
      } finally {
        report.pages.push(result);
        await context.close();
      }
      console.log(`[axe] ${path}: ${result.violations.length} violations; ${result.incomplete.length} manual checks; error=${Boolean(result.error || result.pageErrors.length)}`);
    }
    if (report.pages.length === pages.length && report.pages.every(page => !page.error && !page.pageErrors.length && !page.violations.length)) report.status = 'PASS';
  } catch (error) {
    report.error = error.message;
  } finally {
    await browser?.close();
    await writeFile(join(outputDir, 'axe.json'), JSON.stringify(report, null, 2) + '\n');
  }
  if (report.status !== 'PASS') throw new Error(`Local accessibility audit failed; inspect ${join(outputDir, 'axe.json')}`);
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  auditLocalAccessibility({ baseURL: process.env.QA_BASE_URL, outputDir: process.env.QA_OUTPUT_DIR }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
