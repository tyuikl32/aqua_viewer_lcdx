import { test, expect, type Page } from '@playwright/test';
import { setup, ok } from './fixture';

/** 国服卡号：2430443067 + pad10(userId*83+4579)，userId 10000000 */
const CN_CARD = '24304430670830004579';
/** 实体 Aime 卡：线上账号 2890420081 的真实默认卡 */
const PHYSICAL_CARD = '50143954486701365311';
/** 旧方案卡号：243044306799 + 8 位原始 clientId（LCTitleServer 兼容，LCDXNetApi 拒） */
const LEGACY_CN_CARD = '24304430679911909652';

/**
 * 打开设置页并桩掉页面依赖：给定默认卡号，返回所有 mergeRegistry 请求路径。
 * luid 传空串表示账号没有卡。`#username` 有值即代表 user 已加载、判定已执行。
 */
async function openSettingsWithDefaultCard(page: Page, luid: string) {
  const cards = luid ? [{ default: true, extId: '100', luid }] : [];
  await page.route('**/api/user/me', route => route.fulfill({ json: ok({ username: '123456', roles: [], cards }) }));
  await page.route('**/api/game/maimai2/profile?*', route => route.fulfill({ json: { userName: 'Offline Player' } }));
  await page.route('**/api/game/maimai2/config/userPhoto/divMaxLength', route => route.fulfill({ json: 10 }));
  await page.route('**/lcdx/getBindAccessCode/**', route => route.fulfill({ json: ok('') }));
  const mergeCalls: string[] = [];
  await page.route('**/lcdx/mergeRegistry/**', route => {
    mergeCalls.push(new URL(route.request().url()).pathname);
    return route.fulfill({ json: ok({ isOnRequest: false }) });
  });
  await page.goto('/mai2/setting');
  await expect(page.locator('#username')).toHaveValue('Offline Player');
  return mergeCalls;
}

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
  // 默认卡必须是国服卡号（2430443067 + pad10(userId*83+4579)）；非国服号不渲染引继入口
  const selected = '24304430670830004579';
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

test('merge entry is hidden for a physical Aime card', async ({ page }) => {
  await setup(page);
  const mergeCalls = await openSettingsWithDefaultCard(page, PHYSICAL_CARD);
  await expect(page.getByRole('button', { name: 'Set Merge', exact: true })).toHaveCount(0);
  await expect(page.getByText('CN Data Merge', { exact: true })).toHaveCount(0);
  expect(mergeCalls).toEqual([]);
});

test('merge entry is shown for the legacy CN card scheme', async ({ page }) => {
  await setup(page);
  // 旧码段（243044306799 + 8 位 cid）已与后端同步放宽：旧码用户同样需要引继能力
  const mergeCalls = await openSettingsWithDefaultCard(page, LEGACY_CN_CARD);
  await expect(page.getByRole('button', { name: 'Set Merge', exact: true })).toBeEnabled();
  expect(mergeCalls.length).toBeGreaterThan(0);
});

test('merge entry is hidden when the account has no card', async ({ page }) => {
  await setup(page, 10, true, true, undefined, 'none');
  const mergeCalls = await openSettingsWithDefaultCard(page, '');
  await expect(page.getByRole('button', { name: 'Set Merge', exact: true })).toHaveCount(0);
  expect(mergeCalls).toEqual([]);
});

test('merge entry hides itself when the backend rejects the card id', async ({ page }) => {
  await setup(page);
  await page.route('**/api/user/me', route => route.fulfill({ json: ok({ username: '123456', roles: [], cards: [{ default: true, extId: '100', luid: CN_CARD }] }) }));
  await page.route('**/api/game/maimai2/profile?*', route => route.fulfill({ json: { userName: 'Offline Player' } }));
  await page.route('**/api/game/maimai2/config/userPhoto/divMaxLength', route => route.fulfill({ json: 10 }));
  await page.route('**/lcdx/getBindAccessCode/**', route => route.fulfill({ json: ok('') }));
  await page.route('**/lcdx/mergeRegistry/**', route => route.fulfill({ json: { status: { code: 94001, message: 'Invalid card id' } } }));
  await page.goto('/mai2/setting');
  await expect(page.locator('#username')).toHaveValue('Offline Player');
  await expect(page.getByRole('button', { name: 'Set Merge', exact: true })).toHaveCount(0);
});
