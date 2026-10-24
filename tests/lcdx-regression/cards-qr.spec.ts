import { test, expect, type Page } from '@playwright/test';
import { setup, ok } from './fixture';

/** 新码国服卡：2430443067 + pad10(10000000*83+4579) */
const CN_CARD = '24304430670830004579';
/** 旧码国服卡：243044306799 + 8 位 clientId */
const LEGACY_CARD = '24304430679911909652';
/** 实体 Aime 卡：不具备 2430 号段，不应出现二维码入口 */
const PHYSICAL_CARD = '50143954486701365311';

const QR_BUTTON = 'Arcade login QR';

/** 打开卡片页并为每个 luid 造一张主卡（i=0 为默认卡）。 */
async function openCards(page: Page, luids: string[]) {
  await page.route('**/api/user/me', route =>
    route.fulfill({
      json: ok({
        username: '123456',
        roles: [],
        cards: luids.map((luid, index) => ({
          id: index + 1,
          extId: String(100 + index),
          luid,
          registerTime: '',
          accessTime: '',
          default: index === 0,
          cardExternalList: [],
        })),
      }),
    }),
  );
  await page.goto('/cards');
}

test('QR entry is shown for new and legacy CN cards but not for a physical card', async ({ page }) => {
  await setup(page);
  await openCards(page, [CN_CARD, LEGACY_CARD, PHYSICAL_CARD]);

  // 新码 + 旧码各一个入口，实体卡没有
  await expect(page.getByRole('button', { name: QR_BUTTON })).toHaveCount(2);
});

test('no QR entry when the account has no card', async ({ page }) => {
  await setup(page);
  await openCards(page, []);

  await expect(page.getByRole('button', { name: QR_BUTTON })).toHaveCount(0);
});

test('opening the QR dialog renders the image and starts the countdown', async ({ page }) => {
  await setup(page);
  await page.route('**/lcdx/cardQr/**', route =>
    route.fulfill({
      json: ok({ payload: 'NCBTCMDDA1C492FF43D14A47BCE8FFBB4EAD5CF5', expiresInSeconds: 540 }),
    }),
  );
  await openCards(page, [CN_CARD]);

  await page.getByRole('button', { name: QR_BUTTON }).click();

  await expect(page.locator(`img[alt="${QR_BUTTON}"]`)).toBeVisible();
  await expect(page.getByText('09:00 left')).toBeVisible();
  await expect(page.getByText('Do not share this QR code.')).toBeVisible();
});

test('throttled generation surfaces the too-frequent message', async ({ page }) => {
  await setup(page);
  await page.route('**/lcdx/cardQr/**', route =>
    route.fulfill({ json: { status: { code: 94032, message: 'too frequent' } } }),
  );
  await openCards(page, [CN_CARD]);

  await page.getByRole('button', { name: QR_BUTTON }).click();

  await expect(page.getByText('Too frequent, please try again later.')).toBeVisible();
});

test('unsupported card id (94001) surfaces the unsupported message', async ({ page }) => {
  await setup(page);
  await page.route('**/lcdx/cardQr/**', route =>
    route.fulfill({ json: { status: { code: 94001, message: 'invalid' } } }),
  );
  await openCards(page, [CN_CARD]);

  await page.getByRole('button', { name: QR_BUTTON }).click();

  await expect(page.getByText('This card cannot be used for a login QR.')).toBeVisible();
});

/** 通用失败文案：错误态下**任何**情况都不该和具体原因同时出现。 */
const GENERIC_FAILURE = 'Failed to generate the QR code';

/**
 * 回归 P1-1：错误态曾经同时渲染「Failed to render, please refresh」和具体原因。
 * 后者在 94032 时还把刷新按钮禁用了 10 秒，等于指引用户去做一件必然失败的事。
 *
 * 关键点：必须断言通用文案 **count === 0**。只断言具体文案可见的用例抓不到这个 bug。
 */
for (const [code, message] of [
  [94032, 'Too frequent, please try again later.'],
  [94001, 'This card cannot be used for a login QR.'],
  [94031, 'This card does not belong to your account.'],
  [95001, 'Unable to verify card ownership, please retry.'],
] as const) {
  test(`${code} shows exactly one error message and no generic failure copy`, async ({ page }) => {
    await setup(page);
    await page.route('**/lcdx/cardQr/**', route =>
      route.fulfill({ json: { status: { code, message: 'stubbed' } } }),
    );
    await openCards(page, [CN_CARD]);

    await page.getByRole('button', { name: QR_BUTTON }).click();

    await expect(page.getByText(message)).toHaveCount(1);
    await expect(page.getByText(GENERIC_FAILURE)).toHaveCount(0);
  });
}

/**
 * 回归 P2-9：暗色主题下二维码必须仍是**白底黑块**。
 *
 * 不截图比对（要维护基线图、字体渲染有差异），直接读渲染结果：
 * ① 容器计算样式为纯白；② 图内中间调像素占比 < 2%（任何主题染色或半透明叠加都会
 * 把这个值顶起来）；③ 亮度跨 0–255。失败模式很隐蔽——代码看起来完全正常，
 * 只有机台 ZXing 会静默扫不出。
 */
for (const family of ['legacy', 'liquefy']) {
  test(`QR stays black-on-white in ${family} dark theme`, async ({ page }) => {
    await setup(page);
    await page.addInitScript(({ family }) => {
      localStorage.setItem('themeFamily', family);
      localStorage.setItem('colorTheme', 'dark');
    }, { family });
    await page.route('**/lcdx/cardQr/**', route =>
      route.fulfill({
        json: ok({ payload: 'NCBTCMDDA1C492FF43D14A47BCE8FFBB4EAD5CF5', expiresInSeconds: 540 }),
      }),
    );
    await openCards(page, [CN_CARD]);

    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await page.getByRole('button', { name: QR_BUTTON }).click();
    await expect(page.locator(`img[alt="${QR_BUTTON}"]`)).toBeVisible();

    const measured = await page.evaluate(async (alt) => {
      const el = document.querySelector<HTMLImageElement>(`img[alt="${alt}"]`);
      if (!el) return null;
      const container = el.parentElement!;
      const bmp = await createImageBitmap(await (await fetch(el.src)).blob());
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      const { data } = ctx.getImageData(0, 0, bmp.width, bmp.height);

      let mid = 0;
      let minL = 255;
      let maxL = 0;
      for (let i = 0; i < data.length; i += 4) {
        const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        if (l < minL) minL = l;
        if (l > maxL) maxL = l;
        if (l > 8 && l < 247) mid += 1;
      }

      return {
        containerBg: getComputedStyle(container).backgroundColor,
        midRatio: mid / (bmp.width * bmp.height),
        minL,
        maxL,
      };
    }, QR_BUTTON);

    expect(measured).not.toBeNull();
    expect(measured!.containerBg).toBe('rgb(255, 255, 255)');
    expect(measured!.midRatio).toBeLessThan(0.02);
    expect(measured!.minL).toBeLessThanOrEqual(8);
    expect(measured!.maxL).toBeGreaterThanOrEqual(247);
  });
}

/**
 * 回归 P2-5：服务端给了绝对失效时刻 `expiresAt` 时，倒计时应按它起算，
 * 而不是按 `expiresInSeconds`（后者从响应送达起算，晚一个请求耗时）。
 */
test('countdown follows the server expiresAt when present', async ({ page }) => {
  await setup(page);
  const expiresAt = new Date(Date.now() + 300_000).toISOString();
  await page.route('**/lcdx/cardQr/**', route =>
    route.fulfill({
      json: ok({
        payload: 'NCBTCMDDA1C492FF43D14A47BCE8FFBB4EAD5CF5',
        expiresInSeconds: 540,
        expiresAt,
      }),
    }),
  );
  await openCards(page, [CN_CARD]);

  await page.getByRole('button', { name: QR_BUTTON }).click();

  // 300s → 05:00 上下；若错用了 expiresInSeconds 会显示 09:00
  await expect(page.getByText(/0[45]:\d\d left/)).toBeVisible();
  await expect(page.getByText('09:00 left')).toHaveCount(0);
});

/** 旧后端不返回 expiresAt 时必须回退，否则前端先上会显示异常。 */
test('countdown falls back to expiresInSeconds when the backend has no expiresAt', async ({ page }) => {
  await setup(page);
  await page.route('**/lcdx/cardQr/**', route =>
    route.fulfill({
      json: ok({ payload: 'NCBTCMDDA1C492FF43D14A47BCE8FFBB4EAD5CF5', expiresInSeconds: 540 }),
    }),
  );
  await openCards(page, [CN_CARD]);

  await page.getByRole('button', { name: QR_BUTTON }).click();

  await expect(page.getByText('09:00 left')).toBeVisible();
});
