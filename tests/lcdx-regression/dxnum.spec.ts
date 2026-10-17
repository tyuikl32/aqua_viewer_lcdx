import { expect, test } from '@playwright/test';
import { setup } from './fixture';

const DXNUM_URL = '/mai2/dxnum';
const EN_TITLE = 'Cabinet Player Count';
const SEARCH_INPUT = 'Enter a cabinet alias prefix, e.g. xx';
/** 侧栏条目是 href-less `<a>`（可访问树里不是 link role），按 shell 结构定位 */
const MENU_ITEM = 'aside.sidebar .shell-sidebar-nav a';

/** 输入关键词并提交（回车；查询按钮在空输入时禁用） */
async function search(page: import('@playwright/test').Page, keyword: string) {
  await page.getByLabel(SEARCH_INPUT).fill(keyword);
  await page.getByRole('button', { name: 'Search' }).click();
}

test.describe('dxnum bound-card access', () => {
  test('without a bound card the menu item is hidden and the deep link redirects to dashboard', async ({ page }) => {
    await setup(page, 10, true, true, true, 'none');
    await page.goto(DXNUM_URL);
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator(MENU_ITEM).filter({ hasText: EN_TITLE })).toHaveCount(0);
  });

  test('with a bound card the menu appears, the page opens and shows the empty state', async ({ page }) => {
    await setup(page, 10, true, true, false);
    await page.goto(DXNUM_URL);
    await expect(page).toHaveURL(DXNUM_URL);
    await expect(page.getByRole('heading', { name: EN_TITLE, exact: true })).toBeVisible();
    await expect(page.getByText('Type an alias prefix and search')).toBeVisible();
    await expect(page.locator(MENU_ITEM).filter({ hasText: EN_TITLE })).toBeVisible();
    // 空关键词：查询按钮禁用、未发起任何查询（空态不请求）
    await expect(page.getByRole('button', { name: 'Search' })).toBeDisabled();
  });
});

test.describe('dxnum alias query results', () => {
  test('a multi-cabinet prefix shows per-cabinet numbers and no player name at all', async ({ page }) => {
    await setup(page, 10, true, true, false);
    await page.goto(DXNUM_URL);
    await expect(page.getByText('Type an alias prefix and search')).toBeVisible();

    await search(page, 'dw');

    await expect(page.getByRole('heading', { name: 'Realtime stats for 2 cabinets such as LocA' })).toBeVisible();
    await expect(page.getByText('dw1', { exact: true })).toBeVisible();
    await expect(page.getByText('dw2', { exact: true })).toBeVisible();
    // 当页合计三行（(this page) 标注）
    await expect(page.getByText('Players in the last half hour: 3 (3 plays)')).toBeVisible();
    await expect(page.getByText('(this page)').first()).toBeVisible();
    // 多台隐名：整页不得出现任何玩家名字
    await expect(page.getByText('AlphaPlayer')).toHaveCount(0);
    await expect(page.getByText('BetaPlayer')).toHaveCount(0);
    await expect(page.getByText('Playing now:')).toHaveCount(0);
    await expect(page.getByText('Played within the last two hours:')).toHaveCount(0);
  });

  test('a single-cabinet prefix shows the playing list and the two-hour player list', async ({ page }) => {
    await setup(page, 10, true, true, false);
    await page.goto(DXNUM_URL);
    await expect(page.getByText('Type an alias prefix and search')).toBeVisible();

    await search(page, 'dw1');

    await expect(page.getByRole('heading', { name: 'Realtime stats for LocOne' })).toBeVisible();
    await expect(page.getByText('LC mode: Yes')).toBeVisible();
    await expect(page.getByText('Players in the last half hour: 1 (1 plays)')).toBeVisible();
    // 在玩名单 + 2 小时名单（含次数）
    await expect(page.getByText('Playing now:')).toBeVisible();
    await expect(page.getByText('AlphaPlayer', { exact: true })).toBeVisible();
    await expect(page.getByText('Played within the last two hours:')).toBeVisible();
    await expect(page.getByText('AlphaPlayer (3 plays)')).toBeVisible();
    await expect(page.getByText('BetaPlayer (2 plays)')).toBeVisible();
  });

  test('an unknown prefix reports no match without touching the endpoint twice', async ({ page }) => {
    const requests = await setup(page, 10, true, true, false);
    await page.goto(DXNUM_URL);
    await expect(page.getByText('Type an alias prefix and search')).toBeVisible();

    await search(page, 'zzz');

    await expect(page.getByText('No matching cabinet')).toBeVisible();
    const queries = requests.filter((url) => url.includes('/dxnum/'));
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('keyword=zzz');
  });

  test('degrades gracefully when the dxnum endpoint fails', async ({ page }) => {
    await setup(page, 10, true, true, false);
    // 覆盖 dxnum 路由返回失败（后注册优先，覆盖 fixture 的通配 route）
    await page.route('**/lcdx/cabinet/dxnum/**', route =>
      route.fulfill({ json: { status: { code: 95000, message: 'boom' }, data: null } })
    );
    await page.goto(DXNUM_URL);
    await expect(page.getByText('Type an alias prefix and search')).toBeVisible();

    await search(page, 'dw');

    // 失败降级：标题仍在、提示可见、无结果卡、无崩溃
    await expect(page.getByRole('heading', { name: EN_TITLE, exact: true })).toBeVisible();
    await expect(page.getByText('Query failed, please retry').first()).toBeVisible();
    await expect(page.getByText('No matching cabinet')).toHaveCount(0);
    await expect(page.locator('table')).toHaveCount(0);
  });
});
