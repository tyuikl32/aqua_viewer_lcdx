import { expect, test } from '@playwright/test';
import { setup, ok, user } from './fixture';

test('editing a lock filter does not reload all tables before Apply', async ({ page }) => {
  const requests = await setup(page);
  await page.goto('/mai2/locks');
  await expect(page.getByPlaceholder('Operator QQ')).toBeVisible();
  await expect.poll(() => requests.filter(p => p.includes('/locks/')).length).toBeGreaterThan(0);
  await page.waitForTimeout(250);
  const before = requests.length;
  await page.getByPlaceholder('Operator QQ').fill('987654');
  await page.waitForTimeout(300);
  expect(requests.slice(before).filter(p => ['locks', 'grants', 'permissions', 'user/me'].some(key => p.includes(key)))).toEqual([]);
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await expect.poll(() => requests.filter(p => p.includes('targetQQ=987654')).length).toBe(1);
});

test('cold cabmode entry loads the authenticated mode catalog', async ({ page }) => {
  await setup(page, 10, false);
  await page.route('**/api/user/me', async route => { await new Promise(r => setTimeout(r, 150)); await route.fulfill({ json: ok(user) }); });
  const modes: string[] = [];
  await page.route('**/lcdx/cabinet/modes/**', async route => { modes.push(new URL(route.request().url()).pathname); await route.fulfill({ json: ok({ modes: [{ id: 99, name: 'Audit custom mode', level: 0 }] }) }); });
  await page.goto('/mai2/cabmode');
  await expect.poll(() => [...new Set(modes)]).toEqual(['/lcdx/cabinet/modes/123456']);
  await expect(page.getByText('Audit custom mode', { exact: true })).toBeVisible();
});

for (const finalStatus of ['done', 'pending']) {
  test(`remote final poll preserves ${finalStatus === 'done' ? 'success' : 'timeout'}`, async ({ page }) => {
    await setup(page);
    let polls = 0;
    await page.route('**/lcdx/cabinet/command', route => route.fulfill({ json: ok({ requestId: 'audit-command' }) }));
    await page.route('**/lcdx/cabinet/result/**', route => {
      polls++;
      return route.fulfill({ json: ok({ status: polls === 30 ? finalStatus : 'pending', message: polls === 30 ? 'final response' : null, imageUrl: null }) });
    });
    await page.goto('/mai2/remotecontrol');
    await expect(page.locator('select').first()).toHaveValue('Cabinet A');
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await page.locator('select').nth(1).selectOption('game-reboot');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.badge').filter({ hasText: /^pending$/ })).toBeVisible();
    for (let i = 1; i <= 30; i++) {
      await page.clock.runFor(2000);
      await expect.poll(() => polls).toBe(i);
    }
    await expect(page.locator('.badge').filter({ hasText: finalStatus === 'done' ? /^done$/ : /^timeout$/ })).toBeVisible();
    await page.clock.runFor(4000);
    expect(polls).toBe(30);
  });
}

test('late cabinet info cannot overwrite the newly selected cabinet', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  let requestsA = 0;
  const waiting = new Promise<void>(r => { release = r; });
  await page.route('**/lcdx/cabinet/modes/**', route => route.fulfill({ json: ok({ modes: [{ id: 1, name: 'Mode A', level: 0 }, { id: 2, name: 'Mode B', level: 0 }] }) }));
  await page.route('**/lcdx/cabinet/info/**', async route => {
    const isA = decodeURIComponent(route.request().url()).endsWith('/Cabinet A');
    if (isA) { requestsA++; await waiting; }
    await route.fulfill({ json: ok({ isSpecialMode: isA ? 1 : 2, isRebooting: false, level: 3, settings: [] }) });
  });
  await page.goto('/mai2/cabmode');
  await expect.poll(() => requestsA).toBeGreaterThan(0);
  await page.locator('select.cabinet-select').selectOption('Cabinet B');
  await expect(page.locator('.cab-mode-current')).toContainText('Mode B');
  release();
  await page.waitForTimeout(200);
  await expect(page.locator('.cab-mode-current')).toContainText('Mode B');
});

test('overview ignores stale cabinet responses and handles one failed card', async ({ page }) => {
  await setup(page);
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  let release!: () => void;
  let requested = false;
  const waiting = new Promise<void>(r => { release = r; });
  await page.route('**/lcdx/cabinet/info/**', async route => {
    const isA = decodeURIComponent(route.request().url()).endsWith('/Cabinet A');
    if (isA) { requested = true; await waiting; }
    await route.fulfill({ json: ok({ locationName: isA ? 'Old Location A' : 'New Location B', level: 3, isSpecialMode: 1, isRebooting: false, lastOnline: '2026-09-24T00:00:00Z', settings: [] }) });
  });
  await page.route('**/lcdx/cabinet/players/**', route => route.abort());
  await page.goto('/mai2/cabinets');
  await expect.poll(() => requested).toBe(true);
  await page.locator('select').first().selectOption('Cabinet B');
  await expect(page.getByText('New Location B', { exact: false })).toBeVisible();
  release();
  await page.waitForTimeout(200);
  await expect(page.getByText('New Location B', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('remote polling never overlaps requests for the same session', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  let polls = 0;
  const waiting = new Promise<void>(r => { release = r; });
  await page.route('**/lcdx/cabinet/command', route => route.fulfill({ json: ok({ requestId: 'slow-command' }) }));
  await page.route('**/lcdx/cabinet/result/**', async route => { polls++; await waiting; await route.fulfill({ json: ok({ status: 'done', message: 'finished', imageUrl: null }) }); });
  await page.goto('/mai2/remotecontrol');
  await expect(page.locator('select').first()).toHaveValue('Cabinet A');
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.locator('select').nth(1).selectOption('game-reboot');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.locator('.badge').filter({ hasText: /^pending$/ })).toBeVisible();
  for (let i = 0; i < 5; i++) { await page.clock.runFor(2000); await expect.poll(() => polls).toBeGreaterThan(0); await new Promise(resolve => setTimeout(resolve, 100)); }
  expect(polls).toBe(1);
  release();
  await expect(page.locator('.badge').filter({ hasText: /^done$/ })).toBeVisible();
});
