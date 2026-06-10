import { test, expect } from '@playwright/test';

/**
 * Advanced WhatsApp Bridge E2E Tests
 * Using full Playwright (network mocking, status handling, QR flow)
 */

test.describe('WhatsApp Bridge', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show WhatsApp bridge section', async ({ page }) => {
    await expect(page.getByText(/WhatsApp Bridge/i)).toBeVisible();
    await expect(page.getByTestId('whatsapp-status')).toBeVisible();
  });

  test('should display connected status when bridge is online', async ({ page }) => {
    // Mock successful WhatsApp connection
    await page.route('**/api/whatsapp/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          connected: true,
          phone: '+91XXXXXXXXXX',
          lastSync: new Date().toISOString(),
        }),
      });
    });

    await page.reload();
    
    const status = page.getByTestId('whatsapp-status');
    await expect(status).toContainText('Connected');
    await expect(status).toHaveClass(/connected/);
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

    await expect(page.getByText(/Scan QR Code/i)).toBeVisible();
    await expect(page.getByAltText(/WhatsApp QR/i)).toBeVisible();
  });

  test('should handle bridge reconnection flow', async ({ page }) => {
    // Start disconnected
    await page.route('**/api/whatsapp/reconnect', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    });

    await page.getByRole('button', { name: /Reconnect/i }).click();
    
    await expect(page.getByText(/Reconnecting/i)).toBeVisible();
  });
});
