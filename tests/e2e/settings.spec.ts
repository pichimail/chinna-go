import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app', { timeout: 30000 });
    await page.locator('#nav').getByText('Settings', { exact: true }).click();
  });

  test('should display settings form', async ({ page }) => {
    await expect(page.getByText(/OpenRouter/i).first()).toBeVisible();
    await expect(page.getByText(/OpenAI/i).first()).toBeVisible();
  });

  test('should show Telegram integration field', async ({ page }) => {
    await expect(page.getByText(/Telegram/i).first()).toBeVisible();
  });

  test('should show system version info', async ({ page }) => {
    await expect(page.getByText(/Version|v7/i).first()).toBeVisible();
  });
});
