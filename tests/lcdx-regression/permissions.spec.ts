import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context, page }) => {
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5187') return route.abort();
    if (url.pathname.startsWith('/api/')) {
      return route.fulfill({ json: { status: { code: 92001 }, data: null } });
    }
    return route.continue();
  });
  await page.goto('/');
});

for (const first of ['permission', 'manage-access']) {
  test(`waits for both cabinet probes when ${first} resolves first`, async ({ page }) => {
    let finishSecond!: () => void;
    const second = new Promise<void>(resolve => { finishSecond = resolve; });
    await page.route('**/lcdx/cabinet/**', async route => {
      const isFirst = new URL(route.request().url()).pathname.includes(`/${first}/`);
      if (!isFirst) await second;
      await route.fulfill({ json: { status: { code: 92001 }, data: isFirst
        ? (first === 'permission' ? { permission: 7, qqNumber: 123456 } : { hasManage: true })
        : (first === 'permission' ? { hasManage: true } : { permission: 7, qqNumber: 123456 }) } });
    });
    await page.evaluate(async () => {
      const path = '/src/lib/botPermission.ts';
      const permission = await import(path);
      permission.clearBotPermission();
      permission.loadBotPermission('123456');
    });
    await page.waitForResponse(response => response.url().includes(`/${first}/`));
    await page.waitForTimeout(100);
    const intermediate = await page.evaluate(async () => {
      const path = '/src/lib/botPermission.ts';
      return (await import(path)).getBotPermission();
    });
    finishSecond();
    expect(intermediate.loaded).toBe(false);
    await expect.poll(() => page.evaluate(async () => {
      const path = '/src/lib/botPermission.ts';
      return (await import(path)).getBotPermission();
    })).toMatchObject({ permission: 7, hasManage: true, loaded: true });
  });
}

test('ignores in-flight cabinet probes after logout', async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let requested = 0;
  await page.route('**/lcdx/cabinet/**', async route => {
    requested++;
    await waiting;
    await route.fulfill({ json: { status: { code: 92001 }, data: { permission: 10, hasManage: true, qqNumber: 123456 } } });
  });
  await page.evaluate(async () => {
    const path = '/src/lib/botPermission.ts';
    (await import(path)).loadBotPermission('123456');
  });
  await expect.poll(() => requested).toBe(2);
  await page.evaluate(async () => {
    const path = '/src/lib/botPermission.ts';
    (await import(path)).clearBotPermission();
  });
  release();
  await page.waitForTimeout(200);
  expect(await page.evaluate(async () => {
    const path = '/src/lib/botPermission.ts';
    return (await import(path)).getBotPermission();
  })).toEqual({ permission: 0, qqNumber: null, hasManage: false, loaded: false });
});
test('retains same-user snapshot', async ({ page }) => { const result = await page.evaluate(async () => { const path = '/src/lib/botPermission.ts'; const m = await import(path); m.loadBotPermission('123456'); m.botPermissionStore.set({ permission: 7, hasManage: true, qqNumber: 123456, loaded: true }); m.loadBotPermission('123456'); const same = m.getBotPermission(); m.loadBotPermission('654321'); const other = m.getBotPermission(); m.clearBotPermission(); return { same, other }; }); expect(result.same).toMatchObject({ permission: 7, loaded: true }); expect(result.other).toMatchObject({ permission: 0, loaded: false }); });
