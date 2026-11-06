import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const root = resolve(import.meta.dir, '../..');
const { chromium, webkit } = await import(pathToFileURL(resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs')).href);
const build = await Bun.build({ entrypoints: [resolve(root, 'qa/harness/t05-quiescent-form-browser.tsx')], target: 'browser', define: { 'process.env.NODE_ENV': '"development"' } });
if (!build.success) throw new Error(build.logs.join('\n'));
const js = await build.outputs[0]!.text();
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
  return new URL(request.url).pathname === '/fixture.js'
    ? new Response(js, { headers: { 'Content-Type': 'application/javascript' } })
    : new Response('<!doctype html><div id="root"></div><script type="module" src="/fixture.js"></script>', { headers: { 'Content-Type': 'text/html' } });
} });
const results: object[] = [];
try {
  for (const [name, browserType] of [['chromium', chromium], ['webkit', webkit]] as const) {
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error: Error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.port}`);
      const call = (method: string, value?: unknown): Promise<any> => page.evaluate(({ method, value }: { method: string; value?: unknown }) => (window as any).fixture[method](value), { method, value });
      const check = async (expected: string[]) => {
        const actual = (await call('counts') as string[]).sort();
        if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) throw new Error(`${name}: expected ${expected}; received ${actual}`);
      };
      await page.getByLabel('first', { exact: true }).waitFor();
      await check([]);
      await page.getByLabel('first', { exact: true }).fill('changed');
      await check(['FORM_DIRTY']);
      if (await call('prepare') !== null) throw new Error('Busy form prepared');
      await page.getByLabel('first', { exact: true }).fill('baseline');
      await check([]);
      await page.getByRole('radio').click();
      await check(['FORM_DIRTY']);
      await page.getByRole('radio').click();
      await check([]);
      await page.getByLabel('first', { exact: true }).fill('save value');
      await page.getByLabel('second', { exact: true }).fill('other form dirty');
      await page.getByText('save first', { exact: true }).click();
      await check(['FORM_DIRTY', 'FORM_DIRTY', 'LOCAL_DB_TRANSACTION']);
      await page.getByLabel('first', { exact: true }).fill('intervening edit');
      await call('save', true);
      await check(['FORM_DIRTY', 'FORM_DIRTY']);
      await page.getByText('save first', { exact: true }).click();
      await call('save', false);
      await check(['FORM_DIRTY', 'FORM_DIRTY']);
      await page.getByText('save first', { exact: true }).click();
      await call('save', true);
      await check(['FORM_DIRTY']);
      await page.getByText('save second', { exact: true }).click();
      await call('save', true);
      await check([]);
      const lease = await call('prepare');
      if (!lease || !await call('frozen')) throw new Error('Quiet form did not freeze');
      const inputBefore = await page.getByLabel('first', { exact: true }).inputValue();
      await page.getByLabel('first', { exact: true }).focus();
      await page.keyboard.type('blocked edit');
      if (await page.getByLabel('first', { exact: true }).inputValue() !== inputBefore) throw new Error('Frozen input accepted an edit');
      // Dispatch at the browser boundary while frozen: no React edit or submit may begin.
      await page.locator('#first').evaluate((form: HTMLFormElement) => {
        form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
        form.querySelector('button')!.click();
      });
      await check([]);
      await call('release', lease.leaseId);
      await page.getByRole('radio').click();
      await check(['FORM_DIRTY']);
      if (errors.length) throw new Error(errors.join('; '));
      results.push({ browser: name, status: 'PASS', cases: ['dirty', 'reverted', 'radio', 'busy-preparation', 'pending-save', 'intervening-edit', 'failed-save', 'other-form-retained', 'successful-save', 'frozen-events', 'release'] });
    } finally { await browser.close(); }
  }
} finally { server.stop(true); }
const output = resolve(root, '.qa/t05-quiescent-form-browser.json');
await mkdir(resolve(root, '.qa'), { recursive: true });
await writeFile(output, JSON.stringify({ createdAt: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify({ output, results }));
