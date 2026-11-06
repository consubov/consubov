import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(import.meta.dirname, '../..');
const { chromium, webkit } = await import(pathToFileURL(resolve(root, 'packages/local-data/node_modules/@playwright/test/index.mjs')).href);
const origin = `http://127.0.0.1:${process.env.T03_PORT ?? '5187'}`;

for (const type of [chromium, webkit]) {
  const browser = await type.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(origin);
    await page.locator('#login-email').fill('capataz.lab@consubov.local');
    await page.locator('#login-password').fill('incorrect-laboratory-password');
    const rejected = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/auth/login' && response.request().method() === 'POST');
    await page.getByRole('button', { name: /Entrar no Sistema/i }).click();
    if ((await rejected).status() !== 401) throw new Error(`${type.name()}: invalid password did not receive 401.`);
    await page.getByRole('alert').getByText('Credenciais inválidas.').waitFor({ state: 'visible', timeout: 10000 });
    if (await page.locator('#login-email').inputValue() !== 'capataz.lab@consubov.local') throw new Error('Rejected login lost the mounted form.');
    if (await page.locator('iframe').count()) throw new Error('Rejected login mounted an operational module.');
    console.log(`${type.name()}: rejected login retains form and displays API error; no module loaded`);
  } finally { await browser.close(); }
}
