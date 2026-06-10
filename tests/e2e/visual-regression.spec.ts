import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests using Playwright
 * Screenshots are compared against baseline images
 */

test.describe('Visual Regression', () => {
  test('Dashboard main view should match snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Take full page screenshot and compare
    await expect(page).toHaveScreenshot('dashboard-main.png', {
      fullPage: true,
      threshold: 0.2, // Allow small differences
    });
  });

  test('WhatsApp Bridge section visual test', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="whatsapp-status"]');
    
    const waSection = page.locator('[data-testid="whatsapp-section"]');
    await expect(waSection).toHaveScreenshot('whatsapp-section.png');
  });
});
