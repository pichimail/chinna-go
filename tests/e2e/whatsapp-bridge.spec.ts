import { test, expect } from '@playwright/test';

const navWhatsApp = (page: any) => page.locator('#nav').getByText('WhatsApp', { exact: true });

test.describe('WhatsApp Bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await navWhatsApp(page).click();
  });

  test('should show WhatsApp view', async ({ page }) => {
    await expect(page.getByText(/WhatsApp/i).first()).toBeVisible();
  });

  test('should display connected status when bridge is online', async ({ page }) => {
    await page.route('**/api/whatsapp/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          phone: '+91XXXXXXXXXX',
          lastSync: new Date().toISOString(),
          chats: [],
        }),
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await navWhatsApp(page).click();

    await expect(page.getByText(/Connected/i)).toBeVisible();
  });

  test('should show QR code when bridge is disconnected', async ({ page }) => {
    await page.route('**/api/whatsapp/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: false,
          qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        }),
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await navWhatsApp(page).click();

    await expect(page.getByText(/QR|Scan|Connect/i)).toBeVisible();
  });

  test('should handle bridge reconnection flow', async ({ page }) => {
    await page.route('**/api/whatsapp/reconnect', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    const reconnectBtn = page.getByRole('button', { name: /Reconnect/i });
    if (await reconnectBtn.isVisible()) {
      await reconnectBtn.click();
      await expect(page.getByText(/Reconnecting/i)).toBeVisible();
    }
  });
});
