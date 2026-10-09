import { expect, test } from '@playwright/test';
import { setup } from './fixture';

/**
 * Liquefy 默认主题的壳层几何回归：
 * 内容列（.d-lg-grid.container-xxl）外缘必须与 navbar/footer 浮动面板外缘对齐，
 * toast 覆盖层（.app-toasts）右缘必须贴齐 navbar 面板右缘。
 * 见 .trellis/tasks/10-09-shell-width-alignment/。
 */
for (const width of [1920, 1366, 1280, 992]) {
  test(`liquefy shell panel edges align with content and toast at ${width}px`, async ({ page }) => {
    await setup(page, 4);
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/mai2/cabmode');
    await expect(page.locator('select.cabinet-select')).toBeVisible();

    const edges = await page.evaluate(() => {
      const rect = (selector: string) => {
        const el = document.querySelector(selector);
        return el ? el.getBoundingClientRect().toJSON() : null;
      };
      return {
        navbar: rect('.app-navbar'),
        footer: rect('.footer'),
        grid: rect('.d-lg-grid.container-xxl'),
        toasts: rect('.app-toasts'),
      };
    });

    expect(edges.navbar, 'navbar mounted').not.toBeNull();
    expect(edges.footer, 'footer mounted').not.toBeNull();
    expect(edges.grid, 'content grid mounted').not.toBeNull();
    expect(edges.toasts, 'toast overlay mounted').not.toBeNull();

    expect(Math.abs(edges.navbar!.right - edges.grid!.right), 'navbar right edge == content right edge').toBeLessThanOrEqual(1);
    expect(Math.abs(edges.navbar!.left - edges.grid!.left), 'navbar left edge == content left edge').toBeLessThanOrEqual(1);
    expect(Math.abs(edges.footer!.right - edges.grid!.right), 'footer right edge == content right edge').toBeLessThanOrEqual(1);
    expect(Math.abs(edges.footer!.left - edges.grid!.left), 'footer left edge == content left edge').toBeLessThanOrEqual(1);
    expect(Math.abs(edges.toasts!.right - edges.navbar!.right), 'toast overlay right edge == navbar right edge').toBeLessThanOrEqual(1);
  });
}
