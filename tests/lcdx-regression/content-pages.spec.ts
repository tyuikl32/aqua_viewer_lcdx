import { test, expect, type Page } from '@playwright/test';
import { setup, ok } from './fixture';

const announcement = {
  id: 47, title: 'LCDX announcement',
  updatedAt: '2026-09-24T12:00:00', expirationDate: null,
  status: 'ACTIVE', type: 'UPDATE', priority: 0,
};
const unavailable = 'Announcement content is currently unavailable.';
const rankings = Array.from({ length: 6 }, (_, index) => ({
  userId: 100 + index, currentUserName: 'Player ' + (index + 1),
  score: 3015007 - index * 1000, tournamentId: 20004, rankDate: '2024-11-07T20:18:00.386097',
}));

async function mockAnnouncements(page: Page, content: unknown, translations?: unknown, type = 'UPDATE') {
  const queries: string[] = [];
  await page.route('**/lcdx/announcement/**', route => {
    const url = new URL(route.request().url());
    queries.push(url.pathname + url.search);
    const item = { ...announcement, content, translations, type };
    if (url.pathname.endsWith('/list')) {
      return route.fulfill({ json: ok({ content: [{ ...item, content: null }], totalElements: 1 }) });
    }
    if (url.pathname.endsWith('/recent') && url.searchParams.get('index') === '1') {
      return route.fulfill({ json: { status: { code: 94041 }, data: null } });
    }
    return route.fulfill({ json: ok(item) });
  });
  return queries;
}

for (const entry of ['/announcements', '/dashboard']) {
  for (const [label, value] of [['null', null], ['omitted', undefined], ['empty', ''], ['whitespace', '   ']] as const) {
    test(entry + ' handles ' + label + ' content without a route crash', async ({ page }) => {
      await setup(page);
      const queries = await mockAnnouncements(page, value);
      await page.goto(entry);
      await page.getByRole('heading', { name: announcement.title, exact: true }).click();
      await expect(page.locator('.announcement-content')).toHaveText(unavailable);
      await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
      if (entry === '/announcements') expect(queries.some(q => q.startsWith('/lcdx/announcement/item/47?'))).toBe(true);
    });
  }
}

for (const [label, translations, bodyTitle] of [
  ['LCDX without translations', undefined, 'Base body'],
  ['upstream localized body', [{ language: 'en', translatedTitle: 'Translated title', translatedContent: '# Translated body' }], 'Translated body'],
  ['empty translation falls back', [{ language: 'en', translatedTitle: '', translatedContent: ' ' }], 'Base body'],
] as const) {
  test('announcement preserves ' + label + ' and sanitized Markdown', async ({ page }) => {
    await setup(page);
    const payload = ['# Base body', '', '<strong>Safe HTML</strong><img src=x onerror=alert(1)><script>alert(1)</script>'].join(String.fromCharCode(10));
    await mockAnnouncements(page, payload, translations);
    await page.goto('/announcements');
    await page.locator('.list-group-item h4').click();
    const content = page.locator('.announcement-content');
    await expect(content.getByRole('heading', { name: bodyTitle })).toBeVisible();
    await expect(content.locator('script, [onerror]')).toHaveCount(0);
    if (bodyTitle === 'Base body') await expect(content.locator('strong')).toHaveText('Safe HTML');
  });
}

test('LCDX OTHERS maps to the upstream Other category and filter', async ({ page }) => {
  await setup(page);
  const queries = await mockAnnouncements(page, '# Other announcement', null, 'OTHERS');
  await page.goto('/announcements');
  await expect(page.locator('.list-group-item .badge').first()).toHaveText('Other');
  await page.getByRole('button', { name: 'Other', exact: true }).click();
  await expect.poll(() => queries.some(q => q.includes('type=OTHERS'))).toBe(true);
  await expect(page).toHaveURL(/type=other/);
});

for (const family of ['legacy', 'liquefy', 'animal-island']) {
  for (const width of [1280, 390]) {
    test('KOP ' + family + ' at ' + width + ' keeps legacy table geometry', async ({ page }, testInfo) => {
      await setup(page);
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(family => localStorage.setItem('themeFamily', family), family);
      await page.route('**/lcdx/kop/rank', route => route.fulfill({ json: rankings }));
      await page.goto('/mai2/kop');
      const rows = page.locator('.kop-ranking-page tbody tr');
      await expect(rows).toHaveCount(6);
      await expect(rows.first()).toContainText('301.5007%');
      await expect(rows.first()).toContainText('2024/11/07 20:18:00');
      await expect(rows.nth(3).locator('.rank')).toHaveText('4');
      for (let index = 0; index < 3; index++) {
        const medal = rows.nth(index).locator('img.medal');
        await expect(medal).toHaveAttribute('src', '/assets/' + ['gold', 'silver', 'bronze'][index] + '-medal.svg');
        await expect.poll(() => medal.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      }
      await expect(rows.first().locator('.rank')).toHaveCSS('transform', 'none');
      await expect(rows.first().locator('.name')).toHaveCSS('display', 'table-cell');
      const geometry = await rows.first().evaluate(row => ({
        height: row.getBoundingClientRect().height,
        nameFont: parseFloat(getComputedStyle(row.querySelector('.name')!).fontSize),
        scoreWidth: row.querySelectorAll('td')[2].getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      expect(geometry.height).toBeLessThan(80);
      expect(geometry.nameFont).toBeLessThan(20);
      expect(geometry.scoreWidth).toBeGreaterThan(60);
      expect(geometry.overflow).toBe(false);
      await page.screenshot({ path: testInfo.outputPath('kop.png'), fullPage: true });
    });
  }
}

test('KOP still accepts envelope responses and an empty ranking', async ({ page }) => {
  await setup(page);
  let populated = true;
  await page.route('**/lcdx/kop/rank', route => route.fulfill({ json: ok(populated ? rankings : []) }));
  await page.goto('/mai2/kop');
  await expect(page.locator('.kop-ranking-page tbody tr')).toHaveCount(6);
  populated = false;
  await page.reload();
  await expect(page.locator('.kop-ranking-page tbody tr')).toHaveCount(0);
  await expect(page.locator('.kop-ranking-page .card')).toBeVisible();
});

test('scoped Ongeki styles preserve its own name and rank artwork', async ({ page }) => {
  await setup(page);
  await page.route('**/api/game/ongeki/profile?*', route => route.fulfill({ json: {
    userName: 'Player', level: 20, reincarnationNum: 0, trophyId: 1,
    cardId: 1, characterId: 1, battlePoint: 10000, playerRating: 1500,
    highestRating: 1500, newPlayerRating: 15000, lastRomVersion: '1.50.00',
    playCount: 10, point: 100, medalCount: 1,
  } }));
  await page.goto('/ongeki/profile');
  const root = page.locator('.ongeki-profile-page');
  await expect(root.locator('.name')).toHaveCSS('display', 'flex');
  await expect(root.locator('.rank')).toHaveCSS('position', 'absolute');
  await expect(root.locator('.rank')).not.toHaveCSS('transform', 'none');
  await expect(root.locator('.profile-table')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Unexpected Application Error');
});
