import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const DB_VERSION = 6;
const themes = ['light', 'dark'] as const;

const fakeAccount = {
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
  tokenType: 'Bearer',
};

const fixtureCard = {
  id: 1,
  extId: 10000001,
  luid: 'fixture-maimai-card',
  default: true,
  registerTime: '2026-01-01T00:00:00+08:00',
  accessTime: '2026-01-01T00:00:00+08:00',
  cardExternalList: [],
};

const fakeUser = {
  id: 1,
  username: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.invalid',
  roles: [],
  games: ['maimai2'],
  cards: [fixtureCard],
  defaultCard: fixtureCard,
  keychips: [],
  userTrustKeychips: [],
  oauth2s: [],
};

const maimai2ProfileFixture = {
  userName: 'ＭＡＩ２ ＴＥＳＴ',
  iconId: 1,
  plateId: 2,
  titleId: 3,
  partnerId: 4,
  frameId: 5,
  selectMapId: 6,
  totalAwake: 321,
  gradeRating: 1,
  musicRating: 2,
  playerRating: 12345,
  highestRating: 13000,
  gradeRank: 1,
  classRank: 25,
  courseRank: 14,
  charaSlot: '',
  charaLockSlot: '',
  playCount: 456,
  eventWatchedDate: '2026-08-30T09:30:00+08:00',
  lastRomVersion: '1.55.00',
  lastDataVersion: '1.55.00',
  lastPlayDate: '2026-08-31T20:15:30+08:00',
};

async function installFixtureApi(context: BrowserContext, user = fakeUser) {
  const blockedStateChanges: string[] = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;
    const isBusinessApi =
      isPortal && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));

    if (isBusinessApi && request.method() !== 'GET') {
      blockedStateChanges.push(`${request.method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }

    if (!isPortal || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    let body: unknown;
    if (url.pathname === '/api/account/status') {
      body = {
        data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' },
        status: { code: 92001 },
      };
    } else if (url.pathname === '/api/user/me') {
      body = { data: user, status: { code: 92001 } };
    } else if (url.pathname === '/api/static/dbVersion') {
      body = { state: 'Success', version: { major: DB_VERSION } };
    } else if (url.pathname === '/api/game/maimai2/profile') {
      body = maimai2ProfileFixture;
    } else if (/^\/api\/game\/.*\/data\//.test(url.pathname)) {
      body = [];
    } else {
      body = { data: null, status: { code: 92001 } };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  return blockedStateChanges;
}

async function installStorage(
  context: BrowserContext,
  theme: 'light' | 'dark',
  family: 'legacy' | 'liquefy' | 'animal-island' = 'legacy',
  user = fakeUser,
) {
  await context.addInitScript(
    ({ account, user, selectedTheme, selectedFamily, origins, dbVersion }) => {
      if (!origins.includes(window.location.origin)) return;
      localStorage.setItem('currentAccount', JSON.stringify(account));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('lang', 'zh');
      localStorage.setItem('colorTheme', selectedTheme);
      localStorage.setItem('themeFamily', selectedFamily);
      localStorage.setItem('dbVersion', String(dbVersion));
    },
    {
      account: fakeAccount,
      user,
      selectedTheme: theme,
      selectedFamily: family,
      origins: [LEGACY_ORIGIN, REACT_ORIGIN],
      dbVersion: DB_VERSION,
    },
  );
}

async function settle(page: Page) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByText(maimai2ProfileFixture.userName, { exact: true }).waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
    window.scrollTo(0, 0);
  });
}

async function openPair(context: BrowserContext, viewport: { width: number; height: number }) {
  const legacyPage = await context.newPage();
  const reactPage = await context.newPage();
  await Promise.all([legacyPage.setViewportSize(viewport), reactPage.setViewportSize(viewport)]);
  await Promise.all([
    legacyPage.goto(`${LEGACY_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' }),
    reactPage.goto(`${REACT_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' }),
  ]);
  await Promise.all([settle(legacyPage), settle(reactPage)]);
  return { legacyPage, reactPage };
}

async function compare(
  legacyBuffer: Buffer,
  reactBuffer: Buffer,
  testInfo: TestInfo,
  label: string,
) {
  const legacy = PNG.sync.read(legacyBuffer);
  const react = PNG.sync.read(reactBuffer);
  expect({ width: react.width, height: react.height }).toEqual({
    width: legacy.width,
    height: legacy.height,
  });

  const diff = new PNG({ width: legacy.width, height: legacy.height });
  const mismatchedPixels = pixelmatch(
    legacy.data,
    react.data,
    diff.data,
    legacy.width,
    legacy.height,
    { includeAA: false, threshold: 0.1 },
  );
  const ratio = mismatchedPixels / (legacy.width * legacy.height);

  await fs.mkdir(testInfo.outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(testInfo.outputDir, `${label}-legacy.png`), legacyBuffer),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-react.png`), reactBuffer),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-diff.png`), PNG.sync.write(diff)),
    fs.writeFile(
      path.join(testInfo.outputDir, `${label}-comparison.json`),
      JSON.stringify({ ratio, mismatchedPixels }, null, 2),
    ),
  ]);

  return ratio;
}

async function capturePair(legacyPage: Page, reactPage: Page, testInfo: TestInfo, label: string) {
  const [legacyBuffer, reactBuffer] = await Promise.all([
    legacyPage.screenshot({ animations: 'disabled', caret: 'hide' }),
    reactPage.screenshot({ animations: 'disabled', caret: 'hide' }),
  ]);
  return compare(legacyBuffer, reactBuffer, testInfo, label);
}

function meanHorizontalPixelContrast(buffer: Buffer) {
  const image = PNG.sync.read(buffer);
  let difference = 0;
  let samples = 0;

  for (let y = 0; y < image.height; y += 1) {
    for (let x = 1; x < image.width; x += 1) {
      const current = (y * image.width + x) * 4;
      const previous = current - 4;
      difference +=
        (Math.abs(image.data[current] - image.data[previous]) +
          Math.abs(image.data[current + 1] - image.data[previous + 1]) +
          Math.abs(image.data[current + 2] - image.data[previous + 2])) /
        3;
      samples += 1;
    }
  }

  return difference / samples;
}

async function closeTransientOverlays(legacyPage: Page, reactPage: Page) {
  await Promise.all([legacyPage.keyboard.press('Escape'), reactPage.keyboard.press('Escape')]);
  await Promise.all([
    expect(legacyPage.locator('.popover.show, .dropdown-menu.show')).toHaveCount(0),
    expect(
      reactPage.locator(
        '.shell-user-popover, [role="menu"]',
      ),
    ).toHaveCount(0),
  ]);
}

function visibleNavbarButton(page: Page) {
  return page.locator('.app-navbar button.btn-icon:visible').last();
}

async function expectNoShellNavigation(page: Page) {
  await expect(page.locator('aside.sidebar, .shell-sidebar-nav')).toHaveCount(0);
  await expect(page.locator('.app-navbar-menu-trigger, .navbar-toggler')).toHaveCount(0);
  await expect(page.locator('.shell-mobile-liquid-drawer, .shell-mobile-animal-drawer, .shell-mobile-sheet')).toHaveCount(0);
  expect(await page.locator('main').evaluate((element) => getComputedStyle(element.parentElement!).gridTemplateAreas)).toBe('"main"');
  await expect(page.locator('.navbar-brand')).toBeVisible();
}

function footerTrigger(page: Page, index: number) {
  return page.locator('footer .row.fw-bold > .col-auto').nth(index).locator('a').first();
}

async function expectUserPopoverAboveNavbar(page: Page) {
  const layers = await page.locator('.shell-user-popover').evaluate((popover) => {
    const navbar = document.querySelector<HTMLElement>('.app-navbar');
    if (!navbar) throw new Error('Expected the application navbar to be present.');

    return {
      navbar: Number.parseInt(getComputedStyle(navbar).zIndex, 10),
      popover: Number.parseInt(getComputedStyle(popover).zIndex, 10),
    };
  });

  expect(layers.popover, 'The portalized user popover must render above the fixed navbar.').toBeGreaterThan(
    layers.navbar,
  );
}

async function expectLiquefyFooterToFloatAtViewportBottom(page: Page) {
  const geometry = await page.locator('footer.footer').evaluate((footer) => {
    const bounds = footer.getBoundingClientRect();
    return {
      bottomGap: window.innerHeight - bounds.bottom,
      position: getComputedStyle(footer).position,
    };
  });

  expect(geometry.position).toBe('fixed');
  expect(geometry.bottomGap).toBeGreaterThanOrEqual(0);
  expect(geometry.bottomGap).toBeLessThanOrEqual(12);
}

async function expectLiquefyShellToShareGlassMaterial(page: Page, mobile = false) {
  const selector = mobile
    ? '.app-navbar, footer.footer, .app-navbar-menu-trigger-detached, .shell-mobile-liquid-drawer .lq-drawer__surface'
    : '.app-navbar, footer.footer';
  const surfaces = await page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => {
      const styles = getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        borderTopColor: styles.borderTopColor,
        boxShadow: styles.boxShadow,
        backdropFilter: styles.backdropFilter,
      };
    }),
  );

  expect(surfaces).toHaveLength(mobile ? 4 : 2);
  for (const surface of surfaces.slice(1)) expect(surface).toEqual(surfaces[0]);
}

async function expectLiquefyMobileHeaderToStayWithinViewport(page: Page) {
  const geometry = await page.locator('.app-navbar').evaluate((navbar) => {
    const bounds = navbar.getBoundingClientRect();
    return {
      leftInset: bounds.left,
      rightInset: window.innerWidth - bounds.right,
      viewportWidth: window.innerWidth,
      width: bounds.width,
    };
  });

  expect(geometry.leftInset).toBeGreaterThanOrEqual(7.5);
  expect(geometry.rightInset).toBeGreaterThanOrEqual(7.5);
  expect(geometry.width).toBeCloseTo(
    geometry.viewportWidth - geometry.leftInset - geometry.rightInset,
    4,
  );
}

async function expectLiquefyMobileDrawerToCoverHeader(page: Page) {
  const layers = await page.locator('.shell-mobile-liquid-drawer').evaluate((drawer) => {
    const navbar = document.querySelector<HTMLElement>('.app-navbar');
    const backdrop = document.querySelector<HTMLElement>('.lq-drawer__backdrop');
    if (!navbar || !backdrop) throw new Error('Expected the Liquefy mobile drawer and shell surfaces.');

    const headerStyles = getComputedStyle(navbar);
    return {
      backdrop: Number.parseInt(getComputedStyle(backdrop).zIndex, 10),
      drawer: Number.parseInt(getComputedStyle(drawer).zIndex, 10),
      header: Number.parseInt(headerStyles.zIndex, 10),
    };
  });

  expect(layers.backdrop).toBeGreaterThan(layers.header);
  expect(layers.drawer).toBeGreaterThan(layers.backdrop);
}

async function expectLiquefyMobileDrawerToRemainIsolatedGlass(page: Page) {
  const drawer = page.locator('.shell-mobile-liquid-drawer');
  await expect
    .poll(async () => drawer.evaluate((element) => element.getBoundingClientRect().left))
    .toBeGreaterThanOrEqual(7.5);

  const appearance = await drawer.evaluate((drawer) => {
    const backdrop = document.querySelector<HTMLElement>('.lq-drawer__backdrop');
    const surface = drawer.querySelector<HTMLElement>('.lq-drawer__surface');
    if (!backdrop || !surface) throw new Error('Expected the Liquefy drawer backdrop and surface.');

    const drawerBounds = drawer.getBoundingClientRect();
    const drawerStyles = getComputedStyle(drawer);
    const surfaceStyles = getComputedStyle(surface);
    const backdropStyles = getComputedStyle(backdrop);
    const surfaceBackground = surfaceStyles.backgroundColor;
    const alphaMatch =
      surfaceBackground.match(/\/\s*([\d.]+)\)/) ??
      surfaceBackground.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
    return {
      backdropBackground: backdropStyles.backgroundColor,
      backdropFilter: backdropStyles.backdropFilter,
      bottomInset: window.innerHeight - drawerBounds.bottom,
      borderColor: surfaceStyles.borderColor,
      borderRadii: [
        surfaceStyles.borderTopLeftRadius,
        surfaceStyles.borderTopRightRadius,
        surfaceStyles.borderBottomRightRadius,
        surfaceStyles.borderBottomLeftRadius,
      ],
      boxShadow: surfaceStyles.boxShadow,
      drawerTransform: drawerStyles.transform,
      leftInset: drawerBounds.left,
      surfaceBackgroundAlpha: alphaMatch ? Number.parseFloat(alphaMatch[1]) : 1,
      surfaceFilter: surfaceStyles.backdropFilter,
      surfaceTransform: surfaceStyles.transform,
      topInset: drawerBounds.top,
    };
  });

  expect(appearance.leftInset).toBeGreaterThanOrEqual(7.5);
  expect(appearance.topInset).toBeGreaterThanOrEqual(7.5);
  expect(appearance.bottomInset).toBeGreaterThanOrEqual(7.5);
  expect(new Set(appearance.borderRadii).size).toBe(1);
  expect(Number.parseFloat(appearance.borderRadii[0])).toBeGreaterThan(0);
  expect(appearance.backdropFilter).toBe('none');
  expect(appearance.backdropBackground).toBe('rgba(0, 0, 0, 0)');
  expect(appearance.surfaceFilter).toContain('blur(');
  expect(appearance.surfaceBackgroundAlpha).toBeGreaterThan(0);
  expect(appearance.surfaceBackgroundAlpha).toBeLessThanOrEqual(0.5);
  expect(appearance.drawerTransform).toBe('none');
  expect(appearance.surfaceTransform).toBe('none');
  expect(appearance.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(appearance.boxShadow).toContain('inset');
}

async function openLiquefyDrawerWithInFlightBlurCheck(page: Page) {
  const probeClip = { x: 180, y: 600, width: 72, height: 72 };
  await page.evaluate(({ x, y, width, height }) => {
    const probe = document.createElement('div');
    probe.dataset.drawerBlurProbe = 'true';
    Object.assign(probe.style, {
      background: 'repeating-linear-gradient(90deg, #08252b 0 2px, #f8ffff 2px 4px)',
      height: `${height}px`,
      left: `${x}px`,
      pointerEvents: 'none',
      position: 'fixed',
      top: `${y}px`,
      width: `${width}px`,
      zIndex: '1000',
    });
    document.body.append(probe);
  }, probeClip);

  const baselineContrast = meanHorizontalPixelContrast(await page.screenshot({ clip: probeClip }));
  await page.getByLabel('导航', { exact: true }).click();
  await page.waitForTimeout(120);

  const inFlight = await page.locator('.shell-mobile-liquid-drawer').evaluate((drawer) => {
    const surface = drawer.querySelector<HTMLElement>('.lq-drawer__surface');
    if (!surface) throw new Error('Expected the Liquefy drawer surface.');
    return {
      animationName: getComputedStyle(drawer).animationName,
      drawerTransform: getComputedStyle(drawer).transform,
      surfaceFilter: getComputedStyle(surface).backdropFilter,
      surfaceTransform: getComputedStyle(surface).transform,
    };
  });
  const inFlightContrast = meanHorizontalPixelContrast(await page.screenshot({ clip: probeClip }));

  expect(inFlight.animationName).toBe('liquefy-mobile-drawer-in');
  expect(inFlight.drawerTransform).toBe('none');
  expect(inFlight.surfaceTransform).toBe('none');
  expect(inFlight.surfaceFilter).toContain('blur(');
  expect(inFlightContrast).toBeLessThan(baselineContrast * 0.2);

  await page.locator('[data-drawer-blur-probe]').evaluate((probe) => probe.remove());
}

test.describe('application shell responsive and overlay parity', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const family of ['legacy', 'liquefy', 'animal-island'] as const) {
    for (const colorTheme of themes) {
      test(`anonymous shell hides navigation in ${family} ${colorTheme}`, async ({ browser }, testInfo) => {
        const context = await browser.newContext({
          ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1280, height: 844 },
        });
        try {
          const blockedWrites = await installFixtureApi(context);
          await context.addInitScript(({ family, colorTheme }) => {
            localStorage.setItem('lang', 'zh');
            localStorage.setItem('themeFamily', family);
            localStorage.setItem('colorTheme', colorTheme);
            localStorage.removeItem('currentAccount');
            localStorage.removeItem('currentUser');
          }, { family, colorTheme });
          const page = await context.newPage();
          for (const width of [1280, 390]) {
            await page.setViewportSize({ width, height: 844 });
            for (const pathname of ['/', '/sign-in', '/sign-up', '/password-reset']) {
              await test.step(`${width}px ${pathname}`, async () => {
                await page.goto(`${REACT_ORIGIN}${pathname}`, { waitUntil: 'domcontentloaded' });
                await expect(page.locator(`[data-route-view="${pathname}"]`)).toBeVisible();
                await expect(page.locator('html')).toHaveAttribute('data-theme', family);
                await expect(page.locator('html')).toHaveAttribute('data-color-scheme', colorTheme);
                expect(await page.evaluate(() => localStorage.getItem('currentAccount'))).toBeNull();
                await expectNoShellNavigation(page);
                if (pathname === '/sign-in') {
                  await page.evaluate(async () => { await document.fonts.ready; });
                  await page.screenshot({ path: testInfo.outputPath(`anonymous-${width}.png`) });
                }
              });
            }
            await page.goto(`${REACT_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' });
            await expect(page).toHaveURL(`${REACT_ORIGIN}/`);
            await expectNoShellNavigation(page);
          }
          expect(blockedWrites).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }

    test(`navigation follows account state in ${family}`, async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block' });
      try {
        const blockedWrites = await installFixtureApi(context);
        await installStorage(context, 'dark', family);
        for (const width of [1280, 390]) {
          const page = await context.newPage();
          await page.setViewportSize({ width, height: 844 });
          await page.goto(`${REACT_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' });
          await settle(page);
          if (width === 1280) {
            await expect(page.locator('aside.sidebar')).toBeVisible();
            await expect(page.locator('aside.sidebar .shell-sidebar-nav')).toBeVisible();
          } else {
            await expect(page.locator('aside.sidebar')).toBeHidden();
            await page.locator('.app-navbar-menu-trigger:visible, .navbar-toggler:visible').click();
            await expect(page.locator('.shell-mobile-liquid-drawer, .shell-mobile-animal-drawer, .shell-mobile-sheet')).toBeVisible();
          }
          // Model logout/token loss without sending a real sign-out request.
          await page.evaluate(async () => {
            const modulePath = '/src/lib/auth/account.ts';
            const { clearAccount } = await import(/* @vite-ignore */ modulePath);
            clearAccount();
          });
          expect(await page.evaluate(() => localStorage.getItem('currentAccount'))).toBeNull();
          await expectNoShellNavigation(page);
          await page.locator('.navbar-brand').click();
          await expect(page).toHaveURL(`${REACT_ORIGIN}/`);
          await expectNoShellNavigation(page);
          await page.close();
        }
        expect(blockedWrites).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }

  for (const theme of themes) {
    test(`legacy shell overlays match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
      });
      const blockedStateChanges = await installFixtureApi(context);
      await installStorage(context, theme);
      const comparisons: Array<{ label: string; ratio: number }> = [];

      const mobile = await openPair(context, { width: 390, height: 844 });
      await Promise.all([
        mobile.legacyPage.locator('.navbar-toggler:visible').click(),
        mobile.reactPage.locator('.navbar-toggler:visible').click(),
      ]);
      await Promise.all([
        mobile.legacyPage
          .locator('#sidebar[role="dialog"][aria-modal="true"]')
          .waitFor({ state: 'visible', timeout: 10_000 }),
        mobile.reactPage
          .locator('.shell-mobile-sheet')
          .waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
      comparisons.push({
        label: `mobile-sidebar-${theme}`,
        ratio: await capturePair(
          mobile.legacyPage,
          mobile.reactPage,
          testInfo,
          `mobile-sidebar-${theme}`,
        ),
      });
      await Promise.all([mobile.legacyPage.close(), mobile.reactPage.close()]);

      const desktop = await openPair(context, { width: 1280, height: 720 });
      await Promise.all([
        visibleNavbarButton(desktop.legacyPage).click(),
        visibleNavbarButton(desktop.reactPage).click(),
      ]);
      await Promise.all([
        desktop.legacyPage.locator('.popover.show').waitFor({ state: 'visible', timeout: 10_000 }),
        desktop.reactPage
          .locator('.shell-user-popover')
          .waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
      await expectUserPopoverAboveNavbar(desktop.reactPage);
      comparisons.push({
        label: `user-popover-${theme}`,
        ratio: await capturePair(
          desktop.legacyPage,
          desktop.reactPage,
          testInfo,
          `user-popover-${theme}`,
        ),
      });
      await closeTransientOverlays(desktop.legacyPage, desktop.reactPage);

      await Promise.all([
        desktop.legacyPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)),
        desktop.reactPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)),
      ]);

      await Promise.all([
        footerTrigger(desktop.legacyPage, 0).click(),
        footerTrigger(desktop.reactPage, 0).click(),
      ]);
      await Promise.all([
        desktop.legacyPage
          .locator('.dropdown-menu.show')
          .waitFor({ state: 'visible', timeout: 10_000 }),
        desktop.reactPage
          .getByRole('menu')
          .waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
      comparisons.push({
        label: `language-dropdown-${theme}`,
        ratio: await capturePair(
          desktop.legacyPage,
          desktop.reactPage,
          testInfo,
          `language-dropdown-${theme}`,
        ),
      });
      await closeTransientOverlays(desktop.legacyPage, desktop.reactPage);

      await Promise.all([
        footerTrigger(desktop.legacyPage, 1).click(),
        footerTrigger(desktop.reactPage, 1).click(),
      ]);
      await Promise.all([
        desktop.legacyPage
          .locator('.dropdown-menu.show')
          .waitFor({ state: 'visible', timeout: 10_000 }),
        desktop.reactPage
          .getByRole('menu')
          .waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
      // The React theme menu intentionally adds a family selector above the
      // legacy color choices. Its layout and state transitions are covered by
      // theme-system.spec.ts, so it is not an Angular pixel-parity target.
      await closeTransientOverlays(desktop.legacyPage, desktop.reactPage);

      expect(blockedStateChanges, 'Shell parity must not attempt any Portal state change').toEqual([]);
      expect(
        comparisons.filter(({ ratio }) => ratio > MAX_DIFF_RATIO),
        comparisons
          .map(({ label, ratio }) => `${label}: ${(ratio * 100).toFixed(3)}%`)
          .join('\n'),
      ).toEqual([]);
      await context.close();
    });
  }

  const drawerScrollCases = themes.flatMap((theme) => [684, 844].map((height) => ({ theme, height })));
  for (const { theme, height } of drawerScrollCases) {
    test(`liquefy mobile drawer glass stays fixed while scrolling in ${theme} at ${height}px`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        hasTouch: true,
        ignoreHTTPSErrors: true,
        isMobile: true,
        locale: 'zh-CN',
        serviceWorkers: 'block',
        viewport: { width: 390, height },
      });
      try {
        const user = { ...fakeUser, games: ['ongeki', 'chusan', 'maimai2'] };
        const blockedWrites = await installFixtureApi(context, user);
        await installStorage(context, theme, 'liquefy', user);
        const page = await context.newPage();
        await page.goto(`${REACT_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' });
        await settle(page);
        await page.getByLabel('导航', { exact: true }).click();
        await expectLiquefyMobileDrawerToRemainIsolatedGlass(page);

        const drawer = page.locator('.shell-mobile-liquid-drawer');
        // Capture the stationary frame after the entrance animation finishes,
        // rather than comparing its final subpixel motion with menu scrolling.
        await drawer.evaluate(async (element) => {
          await Promise.all(element.getAnimations().map((animation) => animation.finished));
        });
        const surface = drawer.locator('.lq-drawer__surface');
        const edge = surface.locator(':scope > .lq-surface__edge');
        await expect(edge).toHaveCount(1);
        const originalEdgeBounds = await edge.boundingBox();
        const header = drawer.locator('.lq-drawer__header');
        const originalHeaderBounds = await header.boundingBox();
        const originalPageScroll = await page.evaluate(() => window.scrollY);
        const lastLink = drawer.locator('.shell-sidebar-nav a').last();
        const originalLinkTop = await lastLink.evaluate((link) => link.getBoundingClientRect().top);
        const clip = await surface.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          // This blank strip includes the glass decoration, but no navigation
          // text or scrollbar. Its pixels must not move with the menu content.
          return { x: bounds.right - 28, y: bounds.top + 110, width: 12, height: bounds.height - 160 };
        });
        await page.screenshot({ path: testInfo.outputPath('drawer-scroll-top.png'), animations: 'disabled' });
        const before = PNG.sync.read(await page.screenshot({ clip, animations: 'disabled' }));

        await lastLink.scrollIntoViewIfNeeded();
        await expect.poll(async () => lastLink.evaluate((link) => link.getBoundingClientRect().top))
          .toBeLessThan(originalLinkTop - 100);
        await page.screenshot({ path: testInfo.outputPath('drawer-scroll-bottom.png'), animations: 'disabled' });
        const after = PNG.sync.read(await page.screenshot({ clip, animations: 'disabled' }));
        const diff = new PNG({ width: before.width, height: before.height });
        const movedPixels = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
          includeAA: true,
          threshold: 0.005,
        });
        await testInfo.attach('glass-scroll-diff', { body: PNG.sync.write(diff), contentType: 'image/png' });
        expect.soft(await edge.boundingBox(), 'The decorative glass frame must not move into the scrolling menu.')
          .toEqual(originalEdgeBounds);
        expect.soft(await surface.evaluate((element) => element.scrollTop), 'Only the inner navigation body should scroll.')
          .toBe(0);
        expect(await drawer.locator('.lq-drawer__body').evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
        expect(await header.boundingBox(), 'The title and close button remain reachable after scrolling.').toEqual(originalHeaderBounds);
        expect(await page.evaluate(() => window.scrollY), 'Navigation must not scroll the page behind it.').toBe(originalPageScroll);
        expect(movedPixels / (before.width * before.height), 'The glass tint and edge highlight must stay fixed while navigation scrolls.')
          .toBe(0);
        await expectLiquefyMobileDrawerToRemainIsolatedGlass(page);
        await drawer.locator('.lq-drawer__close').click();
        await expect(drawer).toHaveCount(0);
        expect(blockedWrites).toEqual([]);
      } finally {
        await context.close();
      }
    });
  }

  test('liquefy shell overlays remain functional and read-only', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      reducedMotion: 'no-preference',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
    });
    const blockedStateChanges = await installFixtureApi(context);
    await installStorage(context, 'light', 'liquefy');

    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${REACT_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
    await expect(page.locator('canvas.lq-surface__shader')).toHaveCount(0);
    const mobileHeader = await page.locator('.app-navbar').evaluate((navbar) => {
      const button = document.querySelector<HTMLElement>('.app-navbar-menu-trigger');
      const brand = navbar.querySelector<HTMLElement>('.navbar-brand');
      const desktopSidebar = document.querySelector<HTMLElement>('.sidebar');
      if (!button || !brand || !desktopSidebar) {
        throw new Error('Expected the mobile menu trigger, brand, and desktop sidebar shell.');
      }
      const buttonRect = button.getBoundingClientRect();
      const brandRect = brand.getBoundingClientRect();
      const navbarRect = navbar.getBoundingClientRect();
      const navbarBackground = getComputedStyle(navbar).backgroundColor;
      const alphaMatch =
        navbarBackground.match(/\/\s*([\d.]+)\)/) ??
        navbarBackground.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
      return {
        buttonBorderRadius: getComputedStyle(button).borderRadius,
        buttonBackdropFilter: getComputedStyle(button).backdropFilter,
        buttonBoxShadow: getComputedStyle(button).boxShadow,
        buttonShape: button.getAttribute('data-liquid-shape'),
        buttonLeft: buttonRect.left,
        buttonRight: buttonRect.right,
        brandLeft: brandRect.left,
        buttonInsideNavbar: navbar.contains(button),
        desktopSidebarDisplay: getComputedStyle(desktopSidebar).display,
        desktopSidebarHeight: desktopSidebar.getBoundingClientRect().height,
        navbarBackdropFilter: getComputedStyle(navbar).backdropFilter,
        navbarHasBootstrapShadowClass: navbar.classList.contains('shadow'),
        navbarBackgroundAlpha: alphaMatch ? Number.parseFloat(alphaMatch[1]) : 1,
        navbarBackgroundImage: getComputedStyle(navbar).backgroundImage,
        navbarLeft: navbarRect.left,
        navbarOverflow: getComputedStyle(navbar).overflow,
        navbarShadow: getComputedStyle(navbar).boxShadow,
      };
    });
    expect(mobileHeader.buttonShape).toBe('circle');
    expect(mobileHeader.buttonBorderRadius).toBe('999px');
    expect(mobileHeader.buttonBackdropFilter).toContain('blur(');
    expect(mobileHeader.buttonBoxShadow).toContain('inset');
    expect(mobileHeader.buttonInsideNavbar).toBe(false);
    expect(mobileHeader.desktopSidebarDisplay).toBe('none');
    expect(mobileHeader.desktopSidebarHeight).toBe(0);
    expect(mobileHeader.buttonLeft).toBeLessThan(mobileHeader.navbarLeft);
    expect(mobileHeader.buttonRight).toBeLessThan(mobileHeader.navbarLeft);
    expect(mobileHeader.navbarLeft).toBeLessThan(mobileHeader.brandLeft);
    expect(mobileHeader.navbarBackdropFilter).toContain('blur(');
    expect(mobileHeader.navbarHasBootstrapShadowClass).toBe(false);
    expect(mobileHeader.navbarBackgroundAlpha).toBeGreaterThan(0);
    expect(mobileHeader.navbarBackgroundAlpha).toBeLessThanOrEqual(0.5);
    expect(mobileHeader.navbarBackgroundImage).toBe('none');
    expect(mobileHeader.navbarOverflow).toBe('hidden');
    expect(mobileHeader.navbarShadow).toContain('inset');
    await expectLiquefyMobileHeaderToStayWithinViewport(page);
    await openLiquefyDrawerWithInFlightBlurCheck(page);
    await expect(page.locator('.shell-mobile-liquid-drawer')).toBeVisible();
    await expectLiquefyMobileDrawerToCoverHeader(page);
    await expectLiquefyMobileDrawerToRemainIsolatedGlass(page);
    await expectLiquefyShellToShareGlassMaterial(page, true);
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await expectLiquefyFooterToFloatAtViewportBottom(page);
    await expectLiquefyShellToShareGlassMaterial(page);
    await visibleNavbarButton(page).click();
    await expect(page.locator('.shell-user-popover')).toBeVisible();
    await expectUserPopoverAboveNavbar(page);
    await page.keyboard.press('Escape');
    await visibleNavbarButton(page).click();
    await page.locator('.shell-user-popover a[href="/profile"]').click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.locator('.shell-user-popover')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await footerTrigger(page, 0).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await footerTrigger(page, 1).click();
    await expect(page.getByRole('menuitem', { name: '液态玻璃', exact: true })).toBeVisible();

    expect(blockedStateChanges, 'Liquefy shell smoke test must stay read-only').toEqual([]);
    await context.close();
  });

  async function openScrollableFooterPage(context: BrowserContext, theme: 'light' | 'dark' = 'light', family: 'legacy' | 'liquefy' | 'animal-island' = 'liquefy') {
    const blockedWrites = await installFixtureApi(context);
    await installStorage(context, theme, family);
    const page = await context.newPage();
    await page.goto(`${REACT_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.addStyleTag({ content: 'main { min-height: 2800px; }' });
    return { page, blockedWrites };
  }

  async function finishFooterMotion(page: Page) {
    await page.locator('footer').evaluate(async (element) => {
      await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)));
    });
  }

  async function scrollFooterPage(page: Page, y: number) {
    await page.evaluate(async (top) => {
      window.scrollTo({ top, behavior: 'instant' });
      // Complete this scroll before reversing direction. The application's
      // default smooth scrolling must not continue into the next test action.
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, y);
  }

  for (const theme of themes) {
    test(`liquefy mobile footer morphs into a working glass capsule in ${theme}`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true, serviceWorkers: 'block', isMobile: true, hasTouch: true,
        viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference',
      });
      try {
        const { page, blockedWrites } = await openScrollableFooterPage(context, theme);
        const footer = page.locator('footer');
        const controls = footer.locator('.shell-footer-controls');
        const details = footer.locator('.shell-footer-details');
        await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
        await finishFooterMotion(page);
        const expanded = await footer.boundingBox();
        await page.screenshot({ path: testInfo.outputPath('footer-expanded.png') });

        const probeClip = { x: 50, y: 828, width: 72, height: 4 };
        await page.evaluate(({ x, y, width, height }) => {
          const probe = document.createElement('div');
          probe.dataset.footerBlurProbe = 'true';
          Object.assign(probe.style, {
            position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`,
            background: 'repeating-linear-gradient(90deg, #08252b 0 2px, #f8ffff 2px 4px)',
            pointerEvents: 'none', zIndex: '980',
          });
          document.body.append(probe);
          document.querySelector<HTMLElement>('footer')!.style.visibility = 'hidden';
        }, probeClip);
        const baselineContrast = meanHorizontalPixelContrast(await page.screenshot({ clip: probeClip }));
        await footer.evaluate((element) => { element.style.visibility = ''; });

        await scrollFooterPage(page, 500);
        await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
        // Inspect an exact in-flight frame, without timing-dependent sleeps.
        await footer.evaluate((element) => {
          for (const animation of element.getAnimations()) {
            animation.pause();
            animation.currentTime = 160;
          }
        });
        const motion = await footer.evaluate((element) => {
          const style = getComputedStyle(element);
          return { transform: style.transform, opacity: style.opacity, filter: style.backdropFilter,
            transition: style.transitionProperty, duration: style.transitionDuration,
            width: element.getBoundingClientRect().width };
        });
        expect(motion.transform).toBe('none');
        expect(motion.opacity).toBe('1');
        expect(motion.filter).toContain('blur(');
        expect(motion.transition).toContain('width');
        expect(motion.transition).toContain('height');
        expect(motion.duration).toContain('0.48s');
        expect(motion.width).toBeLessThan(expanded!.width);
        const movingContrast = meanHorizontalPixelContrast(await page.screenshot({ clip: probeClip }));
        expect(movingContrast, 'The moving glass must still blur the content behind it.').toBeLessThan(baselineContrast * 0.2);
        await page.locator('[data-footer-blur-probe]').evaluate((element) => element.remove());
        await page.screenshot({ path: testInfo.outputPath('footer-morphing.png') });
        await footer.evaluate((element) => element.getAnimations().forEach((animation) => animation.play()));
        await finishFooterMotion(page);
        const capsule = await footer.boundingBox();
        expect(capsule!.width).toBeLessThan(expanded!.width * 0.8);
        expect(capsule!.width).toBeLessThan(motion.width);
        expect(capsule!.height).toBeLessThanOrEqual(70);
        expect(capsule!.x).toBeCloseTo(8, 0);
        expect(844 - capsule!.y - capsule!.height).toBeCloseTo(8, 0);
        await expect(details).toBeHidden();
        await expect(details).toHaveAttribute('inert', '');
        await expect(controls.locator('[data-slot="dropdown-menu-trigger"]')).toHaveCount(2);
        await expect(controls).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath('footer-capsule.png') });

        await footerTrigger(page, 0).click();
        await expect(page.getByRole('menu')).toBeVisible();
        await page.getByRole('menuitem', { name: 'English', exact: true }).click();
        await expect(footerTrigger(page, 0)).toContainText('English');
        await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
        await footerTrigger(page, 1).click();
        await expect(page.getByRole('menu')).toBeVisible();
        await page.getByRole('menuitem', { name: theme === 'light' ? 'Dark' : 'Light', exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-color-scheme', theme === 'light' ? 'dark' : 'light');
        await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
        await finishFooterMotion(page);
        const triggerBounds = await controls.boundingBox();
        const changedCapsule = await footer.boundingBox();
        expect(triggerBounds!.x + triggerBounds!.width).toBeLessThan(changedCapsule!.x + changedCapsule!.width);

        // Tiny reversals do not flicker; deliberate upward scrolling expands.
        await scrollFooterPage(page, 496);
        await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
        await scrollFooterPage(page, 400);
        await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
        await finishFooterMotion(page);
        await expect(details).toBeVisible();
        expect((await footer.boundingBox())!.width).toBeCloseTo(expanded!.width, 0);
        expect(await page.evaluate(() => window.scrollY)).toBe(400);
        expect(blockedWrites).toEqual([]);
      } finally { await context.close(); }
    });
  }

  test('liquefy mobile footer expands only on a fresh downward gesture at the bottom', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true, serviceWorkers: 'block', isMobile: true, hasTouch: true,
      viewport: { width: 390, height: 844 },
    });
    try {
      const { page, blockedWrites } = await openScrollableFooterPage(context);
      const footer = page.locator('footer');
      const client = await context.newCDPSession(page);
      const start = (y: number) => client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] });
      const move = (y: number) => client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300, y }] });
      const end = () => client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await start(500);
      await scrollFooterPage(page, await page.evaluate(() => document.documentElement.scrollHeight));
      await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
      await move(380);
      await end();
      await finishFooterMotion(page);
      await expect(footer).toHaveAttribute('data-scroll-state', 'compact');

      await start(500);
      await move(440);
      await move(380);
      await end();
      await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
      await finishFooterMotion(page);
      await expect(footer.locator('.shell-footer-details')).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('footer-bottom-expanded.png') });
      const bottom = await page.evaluate(() => window.scrollY);
      await start(500);
      await move(380);
      await end();
      await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
      expect(await page.evaluate(() => window.scrollY)).toBe(bottom);

      // Nested drawer scrolling/gestures must not control the page footer.
      await scrollFooterPage(page, 100);
      await scrollFooterPage(page, 500);
      await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
      await page.getByLabel('导航', { exact: true }).click();
      await expectLiquefyMobileDrawerToRemainIsolatedGlass(page);
      await start(500);
      await move(320);
      await end();
      await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
      await page.keyboard.press('Escape');
      expect(blockedWrites).toEqual([]);
    } finally { await context.close(); }
  });

  test('liquefy footer supports wheel overscroll, reduced motion and desktop reset', async ({ browser }) => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true, serviceWorkers: 'block', reducedMotion: 'reduce',
      viewport: { width: 390, height: 684 },
    });
    try {
      const { page, blockedWrites } = await openScrollableFooterPage(context);
      const footer = page.locator('footer');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
      await page.mouse.move(300, 300);
      await page.mouse.wheel(0, 120);
      await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
      const duration = await footer.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration));
      expect(duration).toBeLessThan(0.01);
      await scrollFooterPage(page, 100);
      await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
      await scrollFooterPage(page, 500);
      await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
      await scrollFooterPage(page, 900);
      await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
      await expect(footer.locator('.shell-footer-details')).toBeVisible();
      expect(blockedWrites).toEqual([]);
    } finally { await context.close(); }
  });

  test('mobile footer resets on route and theme changes without hiding other themes', async ({ browser }) => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 390, height: 844 },
    });
    try {
      const { page, blockedWrites } = await openScrollableFooterPage(context);
      const footer = page.locator('footer');
      await scrollFooterPage(page, 500);
      await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
      // A client-side route change keeps the footer mounted but resets its state.
      await page.locator('.navbar-brand').click();
      await expect(page).toHaveURL(`${REACT_ORIGIN}/`);
      await expect(footer).toHaveAttribute('data-scroll-state', 'expanded');
      await scrollFooterPage(page, 0);
      await scrollFooterPage(page, 500);
      await expect(footer).toHaveAttribute('data-scroll-state', 'compact');
      await finishFooterMotion(page);
      await footerTrigger(page, 1).click();
      await page.getByRole('menuitem', { name: '经典', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'legacy');
      await expect(footer).not.toHaveAttribute('data-scroll-state');
      await expect(footer.locator('.shell-footer-details')).not.toHaveAttribute('inert');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(footer.locator('.shell-footer-details')).toBeVisible();
      await footerTrigger(page, 1).click();
      await page.getByRole('menuitem', { name: '动物朋友', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'animal-island');
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(footer).not.toHaveAttribute('data-scroll-state');
      await expect(footer.locator('.shell-footer-details')).not.toHaveAttribute('inert');
      await expect(footer.locator('.shell-footer-details')).toBeVisible();
      expect(blockedWrites).toEqual([]);
    } finally { await context.close(); }
  });
});
