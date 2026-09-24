import { expect, test } from '@playwright/test';

const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const songs = ['t+pazolite', 'Other artist', 't+pazolite / LeaF'].map((artistName, index) => ({
  id: index + 4,
  name: `Search fixture ${index + 1}`,
  sortName: `search fixture ${index + 1}`,
  artistName,
  genre: 'POPS＆ANIME',
  bossCardId: 0,
  bossLevel: 1,
  level0: '4,0',
  level1: '8,0',
  level2: '11,7',
  level3: '13,7',
  level4: '0,0',
}));

for (const family of ['liquefy', 'legacy', 'animal-island']) {
  for (const color of ['light', 'dark']) {
    for (const width of [1280, 390]) {
      test(`${family} ${color} ${width}: song suggestions stay above cards and remain clickable`, async ({
        page,
        context,
      }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        // Keep this regression independent of production accounts and catalogs.
        await context.route('**/*', async (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== REACT_ORIGIN) return route.abort();
          if (!url.pathname.startsWith('/api/')) return route.continue();
          const data =
            url.pathname === '/api/account/status'
              ? { banned: false, eulaRequired: false }
              : url.pathname === '/api/user/me'
                ? {
                    id: 1,
                    username: 'fixture',
                    roles: [],
                    games: ['ongeki'],
                    cards: [],
                    defaultCard: null,
                    keychips: [],
                    userTrustKeychips: [],
                    oauth2s: [],
                  }
                : null;
          await route.fulfill({ json: { data, status: { code: 92001 } } });
        });
        await context.addInitScript(
          ({ family, color }) => {
            localStorage.setItem(
              'currentAccount',
              JSON.stringify({
                accessToken: 'fixture-access-token',
                refreshToken: 'fixture-refresh-token',
                tokenType: 'Bearer',
              }),
            );
            localStorage.setItem('lang', 'zh');
            localStorage.setItem('themeFamily', family);
            localStorage.setItem('colorTheme', color);
            localStorage.setItem('dbVersion', '6');
          },
          { family, color },
        );

        await page.goto(`${REACT_ORIGIN}/ongeki/song`);
        await expect(page.locator('.ongeki-song-list-page')).toBeVisible();
        await page.evaluate(async (catalog) => {
          const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('Aqua', 6);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction('ongekiMusic', 'readwrite');
            for (const song of catalog) transaction.objectStore('ongekiMusic').put(song);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          });
          database.close();
        }, songs);
        await page.reload();

        const content = page.locator('.ongeki-song-list-page');
        const cards = content.locator('.card-btn');
        await expect(cards).toHaveCount(3);
        await content.locator('input.form-control-plaintext').fill('t+pazo');
        const suggestions = content.locator('.input-container > .position-absolute');
        await expect(suggestions.locator('a')).toHaveCount(3);
        // Visibility alone misses this bug: covered elements are still "visible".
        for (const suggestion of await suggestions.locator('a').all()) {
          await expect
            .poll(() =>
              suggestion.evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return element.contains(
                  document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
                );
              }),
            )
            .toBe(true);
        }
        await page.screenshot({ path: testInfo.outputPath('suggestions.png') });
        await suggestions.locator('a').filter({ hasText: 't+pazolite / LeaF' }).click();
        await expect(suggestions).toHaveCount(0);
        await expect(cards).toHaveCount(1);
        await expect(cards.first()).toContainText('Search fixture 3');
        await expect(content.locator('.input-container .badge')).toContainText('t+pazolite / LeaF');
      });
    }
  }
}
