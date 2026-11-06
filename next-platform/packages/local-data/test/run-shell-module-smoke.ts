import { chromium, webkit } from '@playwright/test';
import { LAB_DEFAULT_PASSWORD } from '../../auth-client/src/fixtures/synthetic-users';

const origin = Bun.env.F23_SHELL_ORIGIN ?? 'http://127.0.0.1:5179';
for (const browserType of [chromium, webkit]) {
  const browser = await browserType.launch();
  try {
    for (const profile of ['capataz', 'gerente', 'escritorio', 'fabrica']) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        const errors: string[] = [];
        const requestedModules = new Set<string>();
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => {
          const match = new URL(request.url()).pathname.match(/^\/modules\/([^/]+)\//);
          if (match) requestedModules.add(match[1]!);
        });
        await page.goto(origin);
        await page.locator('#login-email').fill(`${profile}.lab@consubov.local`);
        await page.locator('#login-password').fill(LAB_DEFAULT_PASSWORD);
        await page.getByRole('button', { name: 'Entrar no Sistema' }).click();
        await page.getByRole('button', { name: 'Acessar Este Contexto' }).click();
        try {
          await page.frameLocator('iframe').getByTestId(`${profile}-module-view`).waitFor({ timeout: 20000 });
        } catch (error) {
          throw new Error(`${browserType.name()} ${profile}: ${errors.join('; ')}; ${await page.locator('body').innerText()}`, { cause: error });
        }
        if (errors.length) throw new Error(errors.join('; '));
        if (requestedModules.size !== 1 || !requestedModules.has(profile)) throw new Error('Unexpected module download.');
        console.log(`${browserType.name()} ${profile}: iframe rendered; only authorized module fetched`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
