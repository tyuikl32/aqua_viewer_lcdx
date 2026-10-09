import { expect, test } from '@playwright/test';
import { setup } from './fixture';
for (const permission of [0, 3, 4, 7, 10]) {
  for (const route of ['cabmode', 'locks']) {
    test(`P${permission} deep link /mai2/${route} respects its permission tier`, async ({ page }) => {
      await setup(page, permission);
      await page.goto(`/mai2/${route}`);
      await expect.poll(() => page.evaluate(async () => { const path = '/src/lib/botPermission.ts'; return (await import(path)).getBotPermission().loaded; })).toBe(true);
      const allowed = permission >= (route === 'locks' ? 4 : 1);
      await expect(page).toHaveURL(allowed ? `/mai2/${route}` : '/dashboard');
      if (allowed && route === 'cabmode') {
        await expect(page.locator('select.cabinet-select')).toBeVisible();
        await expect(page.locator('select')).toHaveCount(permission >= 4 ? 3 : 1);
      }
      if (allowed && route === 'locks') await expect(page.getByText('Admin Permission', { exact: true })).toHaveCount(permission >= 7 ? 1 : 0);
    });
  }
}


test('unauthenticated existing protected deep link returns home, while unknown path shows 404', async ({ page }) => {
  await setup(page, 10, true, false);
  await page.goto('/mai2/photos');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'NET', exact: true })).toBeVisible();

  await page.goto('/not-a-real-route');
  await expect(page).toHaveURL(/\/not-found$/);
  await expect(page.locator('.nf-404-wrap')).toContainText('404');
});
