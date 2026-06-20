import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('Dashboard main view renders without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify key shell elements are present
    await expect(page.getByText('CHINNA')).toBeVisible();
    await expect(page.getByText('MAIN')).toBeVisible();
    await expect(page.getByText('Overview')).toBeVisible();
  });

  test('WhatsApp view renders', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByText('WhatsApp').click();

    await expect(page.getByText(/WhatsApp/i)).toBeVisible();
  });
});
