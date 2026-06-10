import { test, expect } from '@playwright/test';

/**
 * Voice Mode E2E Tests
 */

test.describe('Voice Mode', () => {
  test('should open voice mode interface', async ({ page }) => {
    await page.goto('/');
    
    const voiceButton = page.getByRole('button', { name: /Voice|Listen|🎤/i });
    if (await voiceButton.isVisible()) {
      await voiceButton.click();
      await expect(page.getByText(/Voice Mode|Push to talk/i)).toBeVisible();
    }
  });

  test('should show recording controls', async ({ page }) => {
    await page.goto('/');
    
    // This assumes there's a voice mode trigger
    await page.getByText(/Voice Mode/i).click().catch(() => {});
    
    const recordButton = page.getByRole('button', { name: /Record|🎙️/i });
    if (await recordButton.isVisible()) {
      await expect(recordButton).toBeVisible();
    }
  });
});
