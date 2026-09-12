import { expect, test, type Locator, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

function stripeContrast(buffer: Buffer) {
  const image = PNG.sync.read(buffer);
  let difference = 0;
  let samples = 0;
  for (let y = 0; y < image.height; y++) {
    for (let x = 1; x < image.width; x++) {
      const offset = (y * image.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        difference += Math.abs(image.data[offset + channel] - image.data[offset + channel - 4]);
        samples++;
      }
    }
  }
  return difference / samples;
}

async function expectInFlightGlass(page: Page, panel: Locator) {
  await panel.evaluate((element) => {
    const probe = document.createElement('div');
    probe.id = 'song-detail-glass-probe';
    Object.assign(probe.style, {
      position: 'fixed',
      inset: '0',
      zIndex: String(Number(getComputedStyle(element).zIndex) - 1),
      pointerEvents: 'none',
      background: 'repeating-linear-gradient(90deg, #08252b 0 2px, #f8ffff 2px 4px)',
    });
    document.body.append(probe);
    const animation = element.getAnimations().find(
      (entry) => entry instanceof CSSAnimation && entry.animationName === 'liquefy-song-detail-in',
    );
    if (!animation) throw new Error('Song detail entrance animation is missing');
    animation.pause();
    animation.currentTime = 120;
  });
  // Keep the entrance paused, but prevent filter interpolation in the A/B probe.
  const noTransition = await page.addStyleTag({ content: '.song-detail-surface { transition: none !important; }' });
  const noGlass = await page.addStyleTag({
    content: '.song-detail-surface { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
  });
  try {
    const rect = await panel.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThan(12);
    const clip = {
      x: Math.ceil(rect!.x + 6), y: Math.floor(rect!.y + rect!.height / 2), width: 8, height: 28,
    };
    await expect(panel).toHaveCSS('backdrop-filter', 'none');
    const sharp = stripeContrast(await page.screenshot({ clip }));
    await noGlass.evaluate((element) => element.remove());
    await expect(panel).toHaveCSS('backdrop-filter', 'blur(24px) saturate(1.5)');
    const blurred = stripeContrast(await page.screenshot({ clip }));
    expect(sharp, 'The control must expose the stripes through a translucent surface').toBeGreaterThan(20);
    expect(blurred, 'Glass must blur the backdrop while the panel is moving').toBeLessThan(sharp * 0.2);
  } finally {
    await page.locator('#song-detail-glass-probe').evaluate((element) => element.remove());
    await noGlass.evaluate((element) => element.remove());
    await noTransition.evaluate((element) => element.remove());
    await panel.evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
  }
}

/** Run against each game's real sheet and read-only API fixtures. */
export async function verifyModernSongDetails(page: Page) {
  for (const family of ['liquefy', 'animal-island'] as const) {
    for (const colorTheme of ['light', 'dark'] as const) {
      await page.evaluate(async (preferences) => {
        const modulePath = '/src/lib/theme.ts';
        const { setTheme } = await import(/* @vite-ignore */ modulePath);
        setTheme(preferences);
      }, { family, colorTheme });
      for (const width of [390, 1280]) {
        await test.step(`${family} ${colorTheme} ${width}px`, async () => {
          await page.setViewportSize({ width, height: 844 });
          await page.locator('.card-btn.card').first().click();
          const panel = page.locator('.song-detail-surface');
          const body = panel.locator(':scope > .offcanvas-body');
          await expect(panel).toBeVisible();
          await panel.evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
          await panel.evaluate(async (element) => {
            await Promise.all(Array.from(element.querySelectorAll('img'), (image) => image.decode().catch(() => {})));
          });
          if (await panel.evaluate((element) => element.classList.contains('maimai2-song-detail'))) {
            await expect(panel.locator('.music-img')).toBeVisible();
          }
          const jacket = panel.locator('.music-info-container .music-img:visible').first();
          if (await jacket.count()) {
            const alignment = await jacket.evaluate((element) => {
              const image = element.getBoundingClientRect();
              const surface = element.closest('.song-detail-surface')!.getBoundingClientRect();
              return { leftSpace: image.left - surface.left, rightSpace: surface.right - image.right };
            });
            expect(Math.abs(alignment.leftSpace - alignment.rightSpace), 'Jacket must be centered in the song detail').toBeLessThan(1);
          }
          const surface = await panel.evaluate((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            const material = (target: Element) => {
              const css = getComputedStyle(target);
              return { fill: css.backgroundColor, filter: css.backdropFilter, border: css.borderTopColor, shadow: css.boxShadow };
            };
            return {
              radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius],
              gaps: [rect.left, innerWidth - rect.right, rect.top, innerHeight - rect.bottom],
              width: rect.width,
              transform: style.transform,
              material: material(element),
              header: material(document.querySelector('.app-navbar')!),
              footer: material(document.querySelector('footer.footer')!),
            };
          });
          if (family === 'liquefy') {
            expect(surface.radii).toEqual(['24px', '24px', '24px', '24px']);
            for (const gap of surface.gaps) expect(gap).toBeGreaterThanOrEqual(11.5);
            expect(surface.width).toBeLessThanOrEqual(Math.min(400, width - 24));
            expect(surface.transform).toBe('none');
            expect(surface.material).toEqual(surface.header);
            expect(surface.material).toEqual(surface.footer);
          } else {
            expect(surface.radii).toEqual(['24px', '0px', '0px', '24px']);
            expect(surface.gaps[1]).toBe(0);
          }
          await page.screenshot({ path: test.info().outputPath(`song-detail-${family}-${colorTheme}-${width}.png`) });
          for (const scrollArea of [panel, body]) {
            await expect(scrollArea).toHaveCSS('scrollbar-width', 'none');
            expect(await scrollArea.evaluate((element) => getComputedStyle(element, '::-webkit-scrollbar').display)).toBe('none');
          }
          await expect(body).toHaveCSS('overflow-y', 'auto');
          const close = panel.locator('.btn-close:visible').first();
          const before = await close.boundingBox();
          const bounds = await body.boundingBox();
          expect(bounds).not.toBeNull();
          await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
          await page.mouse.wheel(0, 220);
          await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
          if (width === 390) {
            await body.evaluate((element) => { element.scrollTop = 0; });
            const cdp = await page.context().newCDPSession(page);
            try {
              const x = Math.round(bounds!.x + bounds!.width / 2);
              const y = Math.round(bounds!.y + bounds!.height * 0.7);
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
              for (let step = 1; step <= 6; step++) {
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 35 }] });
                await page.waitForTimeout(20);
              }
              await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
              await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(40);
            } finally {
              await cdp.detach();
            }
          }
          await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
          const after = await close.boundingBox();
          expect(before).not.toBeNull();
          expect(after).not.toBeNull();
          expect(Math.abs(after!.y - before!.y), 'Close control stays anchored while content scrolls').toBeLessThan(1);
          if (family === 'liquefy' && width === 390) {
            await body.evaluate((element) => { element.scrollTop = 0; });
            await expectInFlightGlass(page, panel);
          }
          await close.click();
          await expect(panel).toHaveCount(0);
        });
      }
    }
  }
}
