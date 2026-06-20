import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('Dashboard main view renders without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 30000 });

    await expect(page.getByText('CHINNA', { exact: true })).toBeVisible();
    await expect(page.locator('#nav').getByText('MAIN', { exact: true })).toBeVisible();
    await expect(page.locator('#nav').getByText('Overview', { exact: true })).toBeVisible();
  });

  test('WhatsApp view renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 30000 });
    await page.locator('#nav').getByText('WhatsApp', { exact: true }).click();

    await expect(page.getByText(/WhatsApp/i).first()).toBeVisible();
  });
});
