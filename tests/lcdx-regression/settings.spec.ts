import { test, expect } from '@playwright/test';
import { setup, ok } from './fixture';

test('LCDX binding still loads when upstream profile requests fail', async ({ page }) => {
  await setup(page);
  await page.route('**/api/game/maimai2/profile?*', route => route.abort());
  await page.route('**/api/game/maimai2/config/userPhoto/divMaxLength', route => route.abort());
  let bindingReads = 0;
  await page.route('**/lcdx/getBindAccessCode/123456/12345678901234567890', route => {
    bindingReads++;
    return route.fulfill({ json: ok('09876543210987654321') });
  });
  await page.goto('/mai2/setting');
  await expect.poll(() => bindingReads).toBeGreaterThan(0);
  await expect(page.locator('#accessCode')).toHaveValue('09876543210987654321');
  await expect(page.locator('#accessCode')).toBeDisabled();
});

test('failed binding lookup does not enable an unsafe add operation', async ({ page }) => {
  await setup(page);
  await page.route('**/api/game/maimai2/profile?*', route => route.fulfill({ json: { userName: 'Offline Player' } }));
  await page.route('**/api/game/maimai2/config/userPhoto/divMaxLength', route => route.fulfill({ json: 10 }));
  await page.route('**/lcdx/getBindAccessCode/**', route => route.fulfill({ json: { status: { code: 94000 }, data: null } }));
  await page.goto('/mai2/setting');
  await page.waitForTimeout(300);
  await expect(page.locator('#accessCode')).toBeDisabled();
});

test('binding uses the first card while merge uses the default card', async ({ page }) => {
  await setup(page);
  const first = '11111111111111111111';
  const selected = '22222222222222222222';
  await page.route('**/api/user/me', route => route.fulfill({ json: ok({ username: '123456', roles: [], cards: [{ extId: '100', luid: first }, { default: true, extId: '200', luid: selected }] }) }));
  await page.route('**/api/game/maimai2/profile?*', route => route.fulfill({ json: { userName: 'Offline Player' } }));
  await page.route('**/api/game/maimai2/config/userPhoto/divMaxLength', route => route.fulfill({ json: 10 }));
  let bindingPath = '';
  await page.route('**/lcdx/getBindAccessCode/**', route => { bindingPath = new URL(route.request().url()).pathname; return route.fulfill({ json: ok('') }); });
  let addBody: unknown;
  await page.route('**/lcdx/addAccessCode/123456', route => { addBody = route.request().postDataJSON(); return route.fulfill({ json: { status: { code: 94000 } } }); });
  const mergeActions: string[] = [];
  await page.route('**/lcdx/mergeRegistry/**', route => {
    if (route.request().method() === 'POST') mergeActions.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: ok({ isOnRequest: false }) });
  });
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/mai2/setting');
  await expect(page.locator('#accessCode')).toBeEnabled();
  expect(bindingPath).toBe('/lcdx/getBindAccessCode/123456/' + first);
  await page.locator('#accessCode').fill('33333333333333333333');
  await page.getByRole('button', { name: 'Try Binding', exact: true }).click();
  await expect.poll(() => addBody).toEqual({ currentAccessCode: first, accessCode: '33333333333333333333' });
  await page.getByRole('button', { name: 'Set Merge', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel Merge', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Cancel Merge', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Set Merge', exact: true })).toBeEnabled();
  expect(mergeActions).toEqual(['/lcdx/mergeRegistry/request/123456/' + selected, '/lcdx/mergeRegistry/cancel/123456/' + selected]);
});
