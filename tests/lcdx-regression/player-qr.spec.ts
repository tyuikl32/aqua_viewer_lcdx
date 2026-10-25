import { test, expect, type Page } from '@playwright/test';
import { setup, ok } from './fixture';

/** 新码国服卡：2430443067 + pad10(10000000*83+4579) */
const CN_CARD = '24304430670830004579';
/** 旧码国服卡：243044306799 + 8 位 clientId */
const LEGACY_CARD = '24304430679911909652';
/** 实体 Aime 卡：不具备 2430 号段 */
const PHYSICAL_CARD = '50143954486701365311';

const PAGE_TITLE = 'Player QR';
const GENERIC_FAILURE = 'Failed to generate the QR code';

/** 打开玩家二维码页，并为每个 luid 造一张主卡（i=0 为默认卡）。 */
async function openPlayerQr(page: Page, luids: string[]) {
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
  await page.goto('/mai2/playerqr');
}

/** 记录所有 cardQr 请求体，便于断言 resume 语义。 */
async function stubPayload(
  page: Page,
  options: { payload?: string; resumed?: boolean; onBody?: (body: any) => void } = {},
) {
  const payload = options.payload ?? 'NCBTCMDDA1C492FF43D14A47BCE8FFBB4EAD5CF5';
  await page.route('**/lcdx/cardQr/**', route => {
    options.onBody?.(route.request().postDataJSON());
    return route.fulfill({
      json: ok({ payload, expiresInSeconds: 540, resumed: options.resumed ?? false }),
    });
  });
}

test('sidebar exposes the Player QR entry and routes to the page', async ({ page }) => {
  await setup(page);
  await stubPayload(page);
  await openPlayerQr(page, [CN_CARD]);

  await page.goto('/dashboard');
  await page.locator('nav.shell-sidebar-nav').getByText(PAGE_TITLE, { exact: true }).click();
  await expect(page).toHaveURL(/\/mai2\/playerqr$/);
});

/** 核心：进入页面即 resume，拿回同一枚码，不需要用户再点一次。 */
test('opening the page resumes and renders the QR', async ({ page }) => {
  await setup(page);
  const bodies: any[] = [];
  await stubPayload(page, { resumed: true, onBody: body => bodies.push(body) });
  await openPlayerQr(page, [CN_CARD]);

  await expect(page.locator(`img[alt="${PAGE_TITLE}"]`)).toBeVisible();
  await expect(page.getByText('09:00 left')).toBeVisible();
  await expect(page.getByText('Do not share this QR code.')).toBeVisible();

  // 挂载必须是 resume 请求
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ cardId: CN_CARD, resume: true });
});

/** 用户点「刷新」= 明确要求发新码。 */
test('refresh button asks for a fresh code', async ({ page }) => {
  await setup(page);
  const bodies: any[] = [];
  await stubPayload(page, { resumed: true, onBody: body => bodies.push(body) });
  await openPlayerQr(page, [CN_CARD]);
  await expect(page.locator(`img[alt="${PAGE_TITLE}"]`)).toBeVisible();

  await page.getByRole('button', { name: 'Refresh', exact: true }).click();

  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toMatchObject({ cardId: CN_CARD, resume: false });
});

test('legacy CN card is accepted too', async ({ page }) => {
  await setup(page);
  await stubPayload(page);
  await openPlayerQr(page, [LEGACY_CARD]);

  await expect(page.locator(`img[alt="${PAGE_TITLE}"]`)).toBeVisible();
});

test('physical card shows the unsupported hint instead of a QR', async ({ page }) => {
  await setup(page);
  let calls = 0;
  await page.route('**/lcdx/cardQr/**', route => {
    calls += 1;
    return route.fulfill({ json: ok({ payload: 'X', expiresInSeconds: 540 }) });
  });
  await openPlayerQr(page, [PHYSICAL_CARD]);

  await expect(page.locator(`img[alt="${PAGE_TITLE}"]`)).toHaveCount(0);
  await expect(page.getByText('Your primary card is not a CN card, so a login QR cannot be generated.')).toBeVisible();
  expect(calls).toBe(0);
});

test('account without a card shows the bind hint', async ({ page }) => {
  await setup(page);
  await stubPayload(page);
  await openPlayerQr(page, []);

  await expect(page.getByText('No card bound yet. Bind a card before generating a login QR.')).toBeVisible();
});

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
    await openPlayerQr(page, [CN_CARD]);

    await expect(page.getByText(message)).toHaveCount(1);
    await expect(page.getByText(GENERIC_FAILURE)).toHaveCount(0);
  });
}

/**
 * 暗色主题下二维码必须仍是**白底黑块**：机台的 ZXing 解码不保证能反色识别，
 * 而这个问题在代码层面完全看不出来，只能靠像素判定。
 */
for (const family of ['legacy', 'liquefy']) {
  test(`QR stays black-on-white in ${family} dark theme`, async ({ page }) => {
    await setup(page);
    await page.addInitScript(({ family }) => {
      localStorage.setItem('themeFamily', family);
      localStorage.setItem('colorTheme', 'dark');
    }, { family });
    await stubPayload(page, { resumed: true });
    await openPlayerQr(page, [CN_CARD]);

    await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
    await expect(page.locator(`img[alt="${PAGE_TITLE}"]`)).toBeVisible();

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
    }, PAGE_TITLE);

    expect(measured).not.toBeNull();
    expect(measured!.containerBg).toBe('rgb(255, 255, 255)');
    expect(measured!.midRatio).toBeLessThan(0.02);
    expect(measured!.minL).toBeLessThanOrEqual(8);
    expect(measured!.maxL).toBeGreaterThanOrEqual(247);
  });
}
