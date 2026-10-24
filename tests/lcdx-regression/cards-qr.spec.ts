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
