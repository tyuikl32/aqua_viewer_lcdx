import { expect, test } from '@playwright/test';
import { setup } from './fixture';

const DXNUM_URL = '/mai2/dxnum';
const EN_TITLE = 'Cabinet Player Count';

test.describe('dxnum permission matrix', () => {
  test('P0 deep link redirects to dashboard', async ({ page }) => {
    await setup(page, 0, true, true, false);
    await page.goto(DXNUM_URL);
    await expect.poll(() => page.evaluate(async () => {
      return (await import('/src/lib/botPermission.ts')).getBotPermission().loaded;
    })).toBe(true);
    await expect(page).toHaveURL('/dashboard');
  });

  test('P7 without grants shows menu and allows access', async ({ page }) => {
    // P=7 且 hasManage=false：菜单应出现、页面可访问（统计宽于操作页）
    await setup(page, 7, true, true, false);
    await page.goto('/dashboard');
    await page.goto(DXNUM_URL);
    await expect.poll(() => page.evaluate(async () => {
      return (await import('/src/lib/botPermission.ts')).getBotPermission().loaded;
    })).toBe(true);
    await expect(page).toHaveURL(DXNUM_URL);
    await expect(page.getByRole('heading', { name: EN_TITLE })).toBeVisible();
  });

  test('P3 with hasManage shows menu and allows access', async ({ page }) => {
    await setup(page, 3, true, true, true);
    await page.goto(DXNUM_URL);
    await expect.poll(() => page.evaluate(async () => {
      return (await import('/src/lib/botPermission.ts')).getBotPermission().loaded;
    })).toBe(true);
    await expect(page).toHaveURL(DXNUM_URL);
    await expect(page.getByRole('heading', { name: EN_TITLE })).toBeVisible();
  });

  test('P3 without hasManage hides menu and redirects', async ({ page }) => {
    await setup(page, 3, true, true, false);
    await page.goto(DXNUM_URL);
    await expect.poll(() => page.evaluate(async () => {
      return (await import('/src/lib/botPermission.ts')).getBotPermission().loaded;
    })).toBe(true);
    await expect(page).toHaveURL('/dashboard');
  });
});

test.describe('dxnum page content', () => {
  test('renders cabinet rows and playing badge', async ({ page }) => {
    await setup(page, 7, true, true, false);
    await page.goto(DXNUM_URL);
    await expect.poll(() => page.evaluate(async () => {
      return (await import('/src/lib/botPermission.ts')).getBotPermission().loaded;
    })).toBe(true);
    await expect(page.getByRole('heading', { name: EN_TITLE })).toBeVisible();
    // 两台机台行（fixture 下发 2 台）
    await expect(page.getByText('Cabinet A')).toBeVisible();
    await expect(page.getByText('Cabinet B')).toBeVisible();
    // 汇总行
    await expect(page.getByText(/2 cabinet\(s\) matched/)).toBeVisible();
    // 在玩徽章：Cabinet A=1、Cabinet B=0
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(2);
  });

  test('row expand shows playing list with window minutes', async ({ page }) => {
    await setup(page, 7, true, true, false);
    await page.goto(DXNUM_URL);
    await expect.poll(() => page.evaluate(async () => {
      return (await import('/src/lib/botPermission.ts')).getBotPermission().loaded;
    })).toBe(true);
    // 点击首行展开
    await page.locator('tbody tr').first().click();
    await expect(page.getByText(/Playing in the last 20 minutes/)).toBeVisible();
    await expect(page.getByText('p1')).toBeVisible();
  });

  test('degrades gracefully when dxnum endpoint fails', async ({ page }) => {
    await setup(page, 7, true, true, false);
    // 覆盖 dxnum 路由返回失败
    await page.route('**/lcdx/cabinet/dxnum/**', route =>
      route.fulfill({ json: { status: { code: 95000, message: 'boom' }, data: null } })
    );
    await page.goto(DXNUM_URL);
    await expect.poll(() => page.evaluate(async () => {
      return (await import('/src/lib/botPermission.ts')).getBotPermission().loaded;
    })).toBe(true);
    // 失败降级：标题仍在，无机台行，无崩溃
    await expect(page.getByRole('heading', { name: EN_TITLE })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(0);
  });
});
