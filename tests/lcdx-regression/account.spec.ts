import { test, expect } from '@playwright/test';
import { setup, user, ok } from './fixture';

const tokens = { tokenType: 'Bearer', accessToken: 'offline-login', refreshToken: 'offline-refresh' };

for (const flow of ['login', 'register']) {
  test(`${flow} preserves LCDX contract and the no-card redirect`, async ({ page }) => {
    await setup(page, 0, false, false);
    await page.route('**/api/user/me', route => route.fulfill({ json: ok({ ...user, cards: [], defaultCard: null }) }));
    let body: unknown;
    const endpoint = flow === 'login' ? '**/lcdx/login' : '**/lcdx/register_confirm/123456';
    await page.route(endpoint, async route => {
      body = route.request().postDataJSON();
      await route.fulfill({ json: ok(tokens) });
    });
    await page.goto(flow === 'login' ? '/sign-in' : '/sign-up');
    await page.locator('#qqNumber').fill('123456');
    await page.locator('#password').fill('offline-password');
    if (flow === 'register') {
      await page.locator('#verifyCode').fill('4321');
      await page.locator('#confirmPassword').fill('offline-password');
    }
    await page.locator('form button[type=submit]').click();
    await expect(page).toHaveURL(/netcode-bind$/);
    expect(body).toEqual(flow === 'login'
      ? { usernameOrEmail: '123456', password: 'offline-password' }
      : { code: '4321', password: 'offline-password' });
  });
}

test('one-time login consumes the token once even in StrictMode', async ({ page }) => {
  await setup(page, 0, false, false);
  await page.route('**/api/user/me', route => route.fulfill({ json: ok({ ...user, cards: [], defaultCard: null }) }));
  let requests = 0;
  await page.route('**/lcdx/onetime-v2/offline-once', async route => {
    requests++;
    await route.fulfill({ json: requests === 1 ? ok(tokens) : { status: { code: 94003 } } });
  });
  await page.goto('/onetime-sign-in?token=offline-once');
  await expect.poll(() => requests).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  expect(requests).toBe(1);
  await expect(page).toHaveURL(/netcode-bind$/);
});

test('no-card users can bind a numeric NET code and continue to the dashboard', async ({ page }) => {
  await setup(page, 0, false);
  let bound = false;
  let method = '';
  await page.route('**/api/user/me', (route) => route.fulfill({
    json: ok(bound ? user : { ...user, cards: [], defaultCard: null }),
  }));
  await page.route('**/lcdx/bind/123456/12345678901234567890', (route) => {
    method = route.request().method();
    bound = true;
    return route.fulfill({ json: ok(null) });
  });
  await page.goto('/netcode-bind');
  const input = page.locator('#netCode');
  const submit = page.locator('form button[type=submit]');
  await input.fill('not-a-number');
  await expect(submit).toBeDisabled();
  await input.fill('12345678901234567890');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/dashboard$/);
  expect(method).toBe('GET');
  await expect(page.getByText('Operation failed', { exact: true })).toHaveCount(0);
});
