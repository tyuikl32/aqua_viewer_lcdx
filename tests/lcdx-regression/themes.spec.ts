import { test, expect } from '@playwright/test';
import { setup, ok } from './fixture';

for (const family of ['legacy', 'liquefy', 'animal-island']) {
  for (const colorTheme of ['light', 'dark']) {
    test(family + ' ' + colorTheme + ' preserves cabinet UI at mobile width', async ({ page }, testInfo) => {
      await setup(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(({ family, colorTheme }) => {
        localStorage.setItem('themeFamily', family);
        localStorage.setItem('colorTheme', colorTheme);
      }, { family, colorTheme });
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/lcdx/cabinet/controllable/**', route => route.fulfill({ json: ok([{ nickName: 'Very long cabinet nickname to exercise the closed select width', fullKeychip: 'A', locationName: 'Long location alias' }]) }));
      await page.route('**/lcdx/cabinet/modes/**', route => route.fulfill({ json: ok({ modes: [{ id: 4, name: 'Offline mode', level: 0 }] }) }));
      await page.route('**/lcdx/cabinet/info/**', route => route.fulfill({ json: ok({ isSpecialMode: 4, isRebooting: false, level: 3, settings: [] }) }));
      await page.goto('/mai2/cabmode');
      await expect(page.locator('html')).toHaveAttribute('data-theme', family);
      await expect(page.locator('html')).toHaveAttribute('data-color-scheme', colorTheme);
      await expect(page.locator('.cab-mode-current')).toContainText('Offline mode');
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      expect(errors).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath('cabmode-mobile.png'), fullPage: true });
    });
  }
}
