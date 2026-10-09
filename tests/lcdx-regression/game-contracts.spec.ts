import { test, expect } from '@playwright/test';
import { setup } from './fixture';

test('rival IDs transform for display and reverse for add and delete', async ({ page }) => {
  await setup(page);
  let addBody: unknown;
  let deletedId: string | null = null;
  const rival = { rivalId: '10000099', rivalName: 'Offline Rival', iconId: 1, awakenCount: 1, playerRating: 12345, playCount: 100, lastPlayDate: '2026-09-24T00:00:00Z' };
  await page.route('**/api/game/maimai2/rival*', route => {
    const method = route.request().method();
    if (method === 'POST') addBody = route.request().postDataJSON();
    if (method === 'DELETE') deletedId = new URL(route.request().url()).searchParams.get('rivalId');
    return route.fulfill({ json: method === 'GET' ? [rival] : true });
  });
  await page.goto('/mai2/rival');
  await expect(page.getByText(String(60001233 - 10000099), { exact: true })).toBeVisible();
  await page.locator('.maimai2-rival-page input').fill('50000123');
  await page.getByRole('button', { name: 'Add Rival', exact: true }).click();
  await expect.poll(() => addBody).toEqual({ rivalId: String(60001233 - 50000123), aimeId: '100' });
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect.poll(() => deletedId).toBe('10000099');
});
