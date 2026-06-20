import { test, expect } from '@playwright/test';

const navWhatsApp = (page: any) => page.locator('#nav').getByText('WhatsApp', { exact: true });

test.describe('Chinna Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for React to fully mount (CDN scripts + Babel transpilation)
    await page.waitForLoadState('networkidle');
  });

  test('should load the dashboard successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Chinna/i);
    await expect(page.getByText('CHINNA')).toBeVisible();
  });

  test('should show sidebar navigation sections', async ({ page }) => {
    await expect(page.getByText('MAIN')).toBeVisible();
    await expect(page.getByText('TOOLS')).toBeVisible();
    await expect(page.getByText('COMMS')).toBeVisible();
  });

  test('should navigate to Settings via sidebar', async ({ page }) => {
    await page.locator('#nav').getByText('Settings', { exact: true }).click();
    await expect(page.getByText(/SETTINGS/i)).toBeVisible();
  });

  test('WhatsApp navigation item should be visible in sidebar', async ({ page }) => {
    await expect(navWhatsApp(page)).toBeVisible();
  });

  test('should navigate to WhatsApp view', async ({ page }) => {
    await navWhatsApp(page).click();
    await expect(page.getByText(/WhatsApp/i).first()).toBeVisible();
  });
});

test.describe('WhatsApp Bridge Integration', () => {
  test('should handle bridge offline state', async ({ page }) => {
    await page.route('**/api/whatsapp/status', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connected: false, qr: null }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navWhatsApp(page).click();

    await expect(page.getByText(/Disconnected|Offline|Connect/i)).toBeVisible();
  });
});
