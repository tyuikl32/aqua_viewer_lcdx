import { expect, test, type Page, type Route } from '@playwright/test';

const ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const games = ['maimai2', 'chunithmV2', 'ongeki'] as const;
type Game = typeof games[number];
const account = { tokenType: 'Bearer', accessToken: 'playlog-admin-access', refreshToken: 'playlog-admin-refresh' };
const user = {
  id: 1, username: 'admin-fixture', name: 'Admin', email: 'admin@example.invalid',
  roles: [{ id: 1, name: 'ROLE_USER' }, { id: 5, name: 'ROLE_ADMIN' }],
  games: [], cards: [], keychips: [], userTrustKeychips: [], oauth2s: [],
};
const aquaAccount = { id: 42, username: 'aqua-player', name: 'Aqua Player', email: 'player@example.invalid' };

function summary(game: Game = 'maimai2', id = 8123) {
  return {
    game, id, playLogId: game === 'maimai2' ? 456789 : null,
    aquaAccount: game === 'chunithmV2' ? aquaAccount : null, userName: 'PLAYER', extId: 12345678,
    accessCode: '00000000000000000001', lastClientId: 'A39E01XXXX',
    playDate: '2026-09-27 12:00:00', userPlayDate: '2026-09-27T12:01:00', musicId: 123, level: 3,
  };
}

function detail(game: Game = 'maimai2', id = 8123) {
  return {
    game, id, playLogId: game === 'maimai2' ? 456789 : null, aquaAccount: game === 'chunithmV2' ? aquaAccount : null,
    user: { detail: { userName: 'PLAYER', accessCode: '00000000000000000001', playerRating: 1500, lastClientId: 'A39E01XXXX', lastPlaceName: '当前店铺' } },
    detail: {
      musicId: 123, level: 3, playDate: '2026-09-27 12:00:00', userPlayDate: '2026-09-27T12:01:00', placeName: '游玩店铺',
      achievement: 1005000, deluxscore: 2345, score: 1009000, techScore: 1007000, battleScore: 999999, platinumScore: 1200, maxCombo: 1234,
      judgeCritical: 100, judgeHeaven: 2, judgeJustice: 3, judgeAttack: 4, judgeGuilty: 5,
      futureField: { preserved: true }, unsafeText: '<img src=x onerror=alert(1)>',
    },
  };
}

async function reply(route: Route, data: unknown, code = 92001, http = 200) {
  await route.fulfill({ status: http, json: { status: { code, message: code === 92001 ? 'OK' : 'Request failed' }, data } });
}

async function setup(page: Page, theme = 'legacy', admin = true) {
  const requests: URL[] = [];
  const writes: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ account, user, theme, admin }) => {
    localStorage.setItem('currentAccount', JSON.stringify(account));
    localStorage.setItem('currentUser', JSON.stringify({ ...user, roles: admin ? user.roles : user.roles.slice(0, 1) }));
    localStorage.setItem('lang', 'zh');
    localStorage.setItem('themeFamily', theme);
    localStorage.setItem('colorTheme', 'light');
    localStorage.setItem('dbVersion', '6');
  }, { account, user, theme, admin });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') {
      writes.push(`${request.method()} ${url.pathname}`);
      await route.abort();
      return;
    }
    requests.push(url);
    const match = url.pathname.match(/^\/api\/admin\/playlogs\/(maimai2|chunithmV2|ongeki)(?:\/(\d+))?$/);
    if (match) {
      const game = match[1] as Game;
      if (match[2]) await reply(route, detail(game, Number(match[2])));
      else {
        const page = Number(url.searchParams.get('page'));
        await reply(route, { content: [summary(game, 8123 - page)], page, totalElements: 13, totalPages: 2 });
      }
    } else if (url.pathname === '/api/account/status') {
      await reply(route, { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' });
    } else if (url.pathname === '/api/user/me') {
      await reply(route, { ...user, roles: admin ? user.roles : user.roles.slice(0, 1) });
    } else if (url.pathname === '/api/static/dbVersion') {
      await route.fulfill({ json: { state: 'Success', version: { major: 6 } } });
    } else if (url.pathname.includes('/data/')) {
      await route.fulfill({ json: [] });
    } else {
      await reply(route, { content: [], page: 0, totalElements: 0, totalPages: 0 });
    }
  });
  return { requests, writes, errors };
}

async function openPlaylogs(page: Page) {
  await page.goto(`${ORIGIN}/admin`);
  await page.getByRole('button', { name: '游玩记录', exact: true }).click();
}

async function search(page: Page, value = '12345678') {
  await page.getByLabel('查询值', { exact: true }).fill(value);
  await page.getByRole('button', { name: '查询记录', exact: true }).click();
}

test('initial state and numeric validation never issue an unfiltered query; identifiers remain strings', async ({ page }) => {
  const audit = await setup(page);
  await openPlaylogs(page);
  await expect(page.getByText('请选择条件并输入查询值。')).toBeVisible();
  await search(page, '   ');
  await expect(page.getByRole('alert')).toHaveText('请输入查询值');
  await search(page, '1e8');
  await expect(page.getByRole('alert')).toContainText('十进制整数');
  expect(audit.requests.filter((url) => url.pathname.includes('/playlogs/'))).toHaveLength(0);
  await search(page, ' 9007199254740993 ');
  await expect(page.getByRole('button', { name: '查看详情 8123' })).toBeVisible();
  expect(audit.requests.filter((url) => url.pathname.includes('/playlogs/')).at(-1)?.searchParams.get('value')).toBe('9007199254740993');
  expect(audit.writes).toEqual([]);
});

for (const game of games) {
  test(`${game}: all supported filters, raw dates, correct detail ID, scores and complete JSON`, async ({ page }) => {
    const audit = await setup(page);
    await openPlaylogs(page);
    await page.getByLabel('游戏', { exact: true }).selectOption(game);
    const fields = ['aquaUsername', 'aquaEmail', 'userName', 'extId', 'accessCode', 'keychipId', 'id', ...(game === 'maimai2' ? ['playLogId'] : [])];
    for (const field of fields) {
      await page.getByLabel('查询条件', { exact: true }).selectOption(field);
      await search(page, ' 000123 ');
      await expect.poll(() => audit.requests.filter((url) => url.pathname.endsWith(`/playlogs/${game}`) && url.searchParams.get('field') === field).length).toBe(1);
      await expect(page.getByRole('button', { name: '查看详情 8123' })).toBeVisible();
    }
    await expect(page.locator('tbody')).toContainText(game === 'chunithmV2' ? 'player@example.invalid' : '未绑定 Aqua');
    await expect(page.locator('tbody')).toContainText('00000000000000000001');
    await expect(page.locator('tbody')).toContainText('2026-09-27 12:00:00');
    await page.getByRole('button', { name: '查看详情 8123' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: '单曲游玩记录', exact: true })).toBeVisible();
    await expect(dialog).toContainText(game === 'chunithmV2' ? 'aqua-player' : '未绑定 Aqua');
    await expect(dialog).toContainText(game === 'maimai2' ? '100.5000%' : game === 'chunithmV2' ? '1009000' : '1007000');
    await expect(dialog).toContainText('2026-09-27T12:01:00');
    await dialog.getByText('完整 JSON', { exact: true }).click();
    await expect(dialog.locator('pre')).toContainText('futureField');
    await expect(dialog.locator('pre')).toContainText('<img src=x onerror=alert(1)>');
    await expect(dialog.locator('img')).toHaveCount(0);
    expect(audit.requests.some((url) => url.pathname.endsWith(`/playlogs/${game}/8123`))).toBe(true);
    expect(audit.requests.some((url) => url.pathname.endsWith('/456789'))).toBe(false);
    expect(audit.writes).toEqual([]);
    expect(audit.errors).toEqual([]);
  });
}

test('changing game resets the Maimai-only filter; paging uses the submitted conditions', async ({ page }) => {
  const audit = await setup(page);
  await openPlaylogs(page);
  await page.getByLabel('查询条件', { exact: true }).selectOption('playLogId');
  await page.getByLabel('查询值', { exact: true }).fill('456789');
  await page.getByLabel('游戏', { exact: true }).selectOption('chunithmV2');
  await expect(page.getByLabel('查询条件', { exact: true })).toHaveValue('id');
  await expect(page.getByLabel('查询值', { exact: true })).toHaveValue('');
  await expect(page.locator('#playlog-field option[value="playLogId"]')).toHaveCount(0);
  await search(page, '8123');
  await expect(page.getByRole('button', { name: '查看详情 8123' })).toBeVisible();
  await page.getByLabel('游戏', { exact: true }).selectOption('ongeki');
  await page.getByLabel('查询值', { exact: true }).fill('999');
  await page.locator('section[aria-label="游玩记录查询"] .pagination').getByText('2', { exact: true }).click();
  await expect(page.getByRole('button', { name: '查看详情 8122' })).toBeVisible();
  const last = audit.requests.filter((url) => url.pathname.includes('/playlogs/')).at(-1)!;
  expect(last.pathname).toBe('/api/admin/playlogs/chunithmV2');
  expect(Object.fromEntries(last.searchParams)).toEqual({ field: 'id', value: '8123', page: '1', size: '12' });
  await page.getByRole('button', { name: '查询记录', exact: true }).click();
  await expect.poll(() => audit.requests.some((url) => url.pathname.endsWith('/ongeki') && url.searchParams.get('page') === '0')).toBe(true);
});

test('empty results and HTTP-200 business failures stay distinct and can be retried', async ({ page }) => {
  await setup(page);
  let count = 0;
  await page.route('**/api/admin/playlogs/maimai2?**', async (route) => {
    count += 1;
    if (count === 1) await reply(route, 'Invalid ExtId from backend', 94001);
    else await reply(route, { content: [], page: 0, totalElements: 0, totalPages: 0 });
  });
  await openPlaylogs(page);
  await search(page);
  await expect(page.getByRole('alert')).toContainText('Invalid ExtId from backend');
  await expect(page.getByText('未找到记录', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByText('未找到记录', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('HTTP 403 retains conditions and displays an error', async ({ page }) => {
  await setup(page);
  await page.route('**/api/admin/playlogs/maimai2?**', (route) => route.fulfill({ status: 403, contentType: 'text/plain', body: 'Forbidden' }));
  await openPlaylogs(page);
  await search(page);
  await expect(page.getByRole('alert')).toContainText('403');
  await expect(page.getByLabel('查询值', { exact: true })).toHaveValue('12345678');
  await expect(page.getByRole('button', { name: '重试', exact: true })).toBeVisible();
});

test('missing detail is retryable; orphan game profiles still show the playlog', async ({ page }) => {
  await setup(page);
  let missing = true;
  await page.route('**/api/admin/playlogs/maimai2/8123', async (route) => {
    if (missing) await reply(route, 'Playlog not found: 8123', 95001);
    else await reply(route, { ...detail(), user: { detail: null } });
  });
  await openPlaylogs(page);
  await search(page);
  await page.getByRole('button', { name: '查看详情 8123' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Playlog not found: 8123');
  missing = false;
  await dialog.getByRole('button', { name: '重试', exact: true }).click();
  await expect(dialog).toContainText('游戏资料已不存在');
  await expect(dialog).toContainText('100.5000%');
});

test('late list and detail responses cannot replace the current selection', async ({ page }) => {
  const audit = await setup(page);
  let oldList: Route | undefined;
  let oldDetail: Route | undefined;
  await page.route('**/api/admin/playlogs/maimai2?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('value') === '111') oldList = route;
    else await reply(route, { content: [summary()], page: 0, totalElements: 1, totalPages: 1 });
  });
  await page.route('**/api/admin/playlogs/maimai2/8123', async (route) => { oldDetail = route; });
  await openPlaylogs(page);
  await search(page, '111');
  await expect.poll(() => Boolean(oldList)).toBe(true);
  await search(page, '222');
  await expect(page.getByRole('button', { name: '查看详情 8123' })).toBeVisible();
  await reply(oldList!, { content: [summary('maimai2', 111)], page: 0, totalElements: 1, totalPages: 1 });
  await page.getByRole('button', { name: '查看详情 8123' }).click();
  await expect.poll(() => Boolean(oldDetail)).toBe(true);
  await page.getByRole('button', { name: '关闭游玩记录详情' }).click();
  await reply(oldDetail!, detail());
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '查看详情 111' })).toHaveCount(0);
  expect(audit.errors).toEqual([]);
});

test('existing user search supports the trimmed Keychip binding query', async ({ page }) => {
  const audit = await setup(page);
  await page.goto(`${ORIGIN}/admin`);
  await page.locator('select').first().selectOption('keychipId');
  await page.getByPlaceholder('搜索内容').fill(' A39E01XXXX ');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect.poll(() => audit.requests.some((url) => url.pathname.endsWith('/advancedUserSearch') && url.searchParams.get('field') === 'keychipId' && url.searchParams.get('pattern') === 'A39E01XXXX')).toBe(true);
  await expect(page.getByText('查询 Keychip 绑定的 Aqua 账户，不包含未绑定账户的游戏资料。')).toBeVisible();
  expect(audit.writes).toEqual([]);
});

test('non-admin users cannot mount the new admin functionality or issue admin requests', async ({ page }) => {
  const audit = await setup(page, 'legacy', false);
  await page.goto(`${ORIGIN}/admin`);
  await expect(page).toHaveURL(`${ORIGIN}/dashboard`);
  await expect(page.getByRole('button', { name: '游玩记录', exact: true })).toHaveCount(0);
  expect(audit.requests.filter((url) => url.pathname.startsWith('/api/admin/'))).toEqual([]);
});

test('an unsafe JSON numeric ID cannot issue an imprecise detail request', async ({ page }) => {
  const audit = await setup(page);
  const unsafe = 9007199254740992;
  await page.route('**/api/admin/playlogs/maimai2?**', (route) => reply(route, { content: [summary('maimai2', unsafe)], page: 0, totalElements: 1, totalPages: 1 }));
  await openPlaylogs(page);
  await search(page);
  await page.getByRole('button', { name: `查看详情 ${unsafe}` }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('无法查询详情');
  expect(audit.requests.filter((url) => /\/playlogs\/maimai2\/\d+$/.test(url.pathname))).toEqual([]);
});

for (const theme of ['legacy', 'liquefy', 'animal-island']) {
  test(`${theme}: desktop and mobile retain usable tables and scrollable detail`, async ({ page }, testInfo) => {
    const audit = await setup(page, theme);
    await openPlaylogs(page);
    await search(page);
    await expect(page.getByRole('button', { name: '查看详情 8123' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${theme}-desktop.png`), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('button', { name: '查询记录', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(await page.locator('section[aria-label="游玩记录查询"] thead').evaluate((element) => element.getBoundingClientRect().height)).toBeLessThan(60);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-mobile.png`), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '查看详情 8123' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('完整 JSON', { exact: true })).toBeVisible();
    await dialog.getByText('完整 JSON', { exact: true }).click();
    await expect(dialog.locator('pre')).toContainText('futureField');
    const bounds = await dialog.boundingBox();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
    const scrollable = await dialog.locator('.modal-body').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop > 0;
    });
    expect(scrollable).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${theme}-detail.png`), animations: 'disabled' });
    await page.getByRole('button', { name: '关闭游玩记录详情' }).click();
    await expect(dialog).toHaveCount(0);
    expect(audit.writes).toEqual([]);
    expect(audit.errors).toEqual([]);
  });
}
