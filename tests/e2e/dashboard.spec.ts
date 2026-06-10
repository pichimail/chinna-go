import { test, expect } from '@playwright/test';

/**
 * Chinna Dashboard E2E Tests
 * Using full Playwright (no Cypress)
 */

test.describe('Chinna Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the dashboard successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/Chinna/i);
    await expect(page.getByText('CHINNA')).toBeVisible();
  });

  test('should show main navigation and status cards', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
    
    // Check key sections
    await expect(page.getByText('Disk Usage')).toBeVisible();
    await expect(page.getByText('Memory')).toBeVisible();
    await expect(page.getByText('System Status')).toBeVisible();
  });

  test('should navigate to different sections', async ({ page }) => {
    // Example: Click on Clean section if it exists
    const cleanLink = page.getByRole('link', { name: /Clean/i });
    if (await cleanLink.isVisible()) {
      await cleanLink.click();
      await expect(page.getByText(/Deep Clean/i)).toBeVisible();
    }
  });

  test('WhatsApp Bridge section should be visible', async ({ page }) => {
    await expect(page.getByText(/WhatsApp/i)).toBeVisible();
    
    // Check connection status area
    const waStatus = page.getByTestId('whatsapp-status');
    await expect(waStatus).toBeVisible();
  });
});

// Example of advanced test with network mocking
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
     
     // Verify UI shows disconnected state
     await expect(page.getByText(/Disconnected|Offline/i)).toBeVisible();
   });
 });
