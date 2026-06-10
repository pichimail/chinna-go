import { test, expect } from '@playwright/test';

/**
 * Settings Page E2E Tests
 */

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to settings if there's a link
    const settingsLink = page.getByRole('link', { name: /Settings|Config/i });
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
    }
  });

  test('should display settings form', async ({ page }) => {
    await expect(page.getByText(/OpenRouter API Key/i)).toBeVisible();
    await expect(page.getByText(/Anthropic API Key/i)).toBeVisible();
  });

  test('should allow updating API keys', async ({ page }) => {
    const openrouterInput = page.getByLabel(/OpenRouter/i);
    await openrouterInput.fill('sk-test-key-12345');
    
    await page.getByRole('button', { name: /Save|Update/i }).click();
    
    await expect(page.getByText(/Settings saved/i)).toBeVisible();
  });
});
