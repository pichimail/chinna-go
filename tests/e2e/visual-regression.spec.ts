import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('Dashboard main view renders without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('CHINNA')).toBeVisible();
    await expect(page.getByText('MAIN')).toBeVisible();
    await expect(page.locator('#nav').getByText('Overview', { exact: true })).toBeVisible();
  });

  test('WhatsApp view renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#nav').getByText('WhatsApp', { exact: true }).click();

    await expect(page.getByText(/WhatsApp/i).first()).toBeVisible();
  });
});
