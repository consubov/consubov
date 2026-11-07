import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/', '/login', '/recuperar-senha']) {
  test(`@a11y-smoke @web-ready public accessibility ${path}`, async ({ page, context, baseURL }, testInfo) => {
    const origin = new URL(baseURL!).origin;
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort('blockedbyclient'));
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    await testInfo.attach('accessibility', { body: JSON.stringify({ violations: results.violations, incomplete: results.incomplete }), contentType: 'application/json' });
    expect(results.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('public-page.png') });
    if (path === '/') {
      await page.getByRole('link', { name: 'Baixar App', exact: true }).click();
      await expect(page).toHaveURL(/\/baixar$/);
    } else if (path === '/login') {
      await page.getByLabel('E-mail', { exact: true }).fill('qa@example.invalid');
      await page.getByRole('link', { name: 'Esqueci minha senha' }).click();
      await expect(page).toHaveURL(/\/recuperar-senha$/);
    } else {
      await page.getByLabel('E-mail', { exact: true }).fill('qa@example.invalid');
      await page.getByRole('link', { name: 'Voltar', exact: true }).click();
      await expect(page).toHaveURL(/\/login$/);
    }
  });
}
