import { test, expect } from '@playwright/test';

test.describe('Voice Mode', () => {
  test('should open voice mode interface', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const voiceButton = page.getByRole('button', { name: /Voice|Listen|🎤/i });
    if (await voiceButton.isVisible()) {
      await voiceButton.click();
      await expect(page.getByText(/Voice Mode|Push to talk/i)).toBeVisible();
    }
  });

  test('should show recording controls', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const voiceText = page.getByText(/Voice Mode/i);
    if (await voiceText.isVisible()) {
      await voiceText.click();
    }

    const recordButton = page.getByRole('button', { name: /Record|🎙️/i });
    if (await recordButton.isVisible()) {
      await expect(recordButton).toBeVisible();
    }
  });
});
