import { chromium, webkit, type BrowserType } from '@playwright/test';
import { resolve } from 'node:path';
import { createServer } from 'node:http';

const authTests = process.argv.includes('--auth');
const storeTests = process.argv.includes('--stores');
const testFile = resolve(import.meta.dir, authTests
  ? '../../auth-client/test/provisioned-auth.browser.test.ts'
  : storeTests ? 'module-store-persistence.test.ts' : 'indexeddb-local-data.test.ts');
const instrumentIndexedDbFailures = !authTests && !storeTests;
const shimFile = resolve(import.meta.dir, 'browser-bun-test-shim.ts');
const build = await Bun.build({
  entrypoints: [testFile],
  target: 'browser',
  format: 'iife',
  write: false,
  plugins: [{
    name: 'bun-test-browser-shim',
    setup(builder) {
      builder.onResolve({ filter: /^bun:test$/ }, () => ({ path: shimFile }));
    }
  }]
});
if (!build.success) throw new AggregateError(build.logs, 'Could not bundle the IndexedDB tests for browsers.');
const bundle = await build.outputs[0]!.text();

const server = createServer((request, response) => {
  if (request.url === '/test.js') {
    response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
    response.end(bundle);
    return;
  }
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`<!doctype html><meta charset="utf-8"><title>IndexedDB local data tests</title>
    <script src="/test.js"></script>
    <script>
      const instrumentIndexedDbFailures = ${instrumentIndexedDbFailures};
      if (instrumentIndexedDbFailures) {
      const originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, key) {
        const request = originalPut.call(this, value, key);
        request.addEventListener('error', () => console.error('IndexedDB put failed', JSON.stringify({store: this.name, requestError: request.error?.name + ': ' + request.error?.message, transactionError: request.transaction.error?.name + ': ' + request.transaction.error?.message})));
        return request;
      };
      const originalTransaction = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function(...args) {
        const transaction = originalTransaction.apply(this, args);
        transaction.addEventListener('error', event => {
          const request = event.target;
          console.error('IndexedDB transaction error', JSON.stringify({database: this.name, transactionError: transaction.error?.name + ': ' + transaction.error?.message, requestError: request?.error?.name + ': ' + request?.error?.message}));
        }, true);
        return transaction;
      };
      }
      window.__localDataBrowserTests=window.__runLocalDataBrowserTests();
    </script>`);
});
await new Promise<void>(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Could not start the local browser test server.');
const url = `http://127.0.0.1:${address.port}/`;

let totalPassed = 0;
let failures = 0;
try {
  const projects: Array<{ name: string; browserType: BrowserType }> = [
    { name: 'Chromium', browserType: chromium },
    { name: 'WebKit', browserType: webkit }
  ];
  for (const { name, browserType } of projects) {
    const browser = await browserType.launch();
    try {
      const page = await browser.newPage();
      const browserDiagnostics: string[] = [];
      page.on('pageerror', error => browserDiagnostics.push(`pageerror: ${error.name}: ${error.message}\n${error.stack ?? ''}`));
      page.on('console', message => {
        if (message.type() === 'error' || message.type() === 'warning') browserDiagnostics.push(`console.${message.type()}: ${message.text()}`);
      });
      await page.goto(url);
      const result = await page.evaluate(() => window.__localDataBrowserTests);
      if (result.total < (authTests ? 4 : 4)) {
        failures++;
        console.error(`${name}: expected at least 4 registered browser tests, received ${result.total}`);
      }
      totalPassed += result.passed;
      failures += result.failed.length;
      console.log(`${name}: ${result.total} registered, ${result.passed} passed, ${result.failed.length} failed`);
      for (const failure of result.failed) console.error(`  ${failure}`);
      for (const diagnostic of browserDiagnostics) console.error(`  ${diagnostic}`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise<void>((resolveClose, rejectClose) => server.close(error => error ? rejectClose(error) : resolveClose()));
}

console.log(`Browser total: ${totalPassed} passed, ${failures} failed`);
if (failures) process.exitCode = 1;
