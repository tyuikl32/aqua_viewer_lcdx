import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

function parseCssColor(value: string): Rgba {
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) {
    throw new Error(`Unsupported CSS color: ${value}`);
  }

  if (value.startsWith('color(srgb')) {
    return [channels[0] * 255, channels[1] * 255, channels[2] * 255, channels[3] ?? 1];
  }

  return [channels[0], channels[1], channels[2], channels[3] ?? 1];
}

function contrastAgainstBackground(foregroundValue: string, backgroundValue: string): number {
  const foreground = parseCssColor(foregroundValue);
  const background = parseCssColor(backgroundValue);
  const composite = foreground.slice(0, 3).map(
    (channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]),
  );
  const luminance = (channels: readonly number[]) => {
    const linear = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const foregroundLuminance = luminance(composite);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

async function semanticColors(
  page: Page,
  foregroundToken: string,
): Promise<{ background: string; foreground: string }> {
  return page.evaluate((token) => {
    const foregroundProbe = document.createElement('span');
    foregroundProbe.style.color = `var(${token})`;
    const backgroundProbe = document.createElement('span');
    backgroundProbe.style.backgroundColor = 'var(--ui-background)';
    document.body.append(foregroundProbe, backgroundProbe);
    const result = {
      background: getComputedStyle(backgroundProbe).backgroundColor,
      foreground: getComputedStyle(foregroundProbe).color,
    };
    foregroundProbe.remove();
    backgroundProbe.remove();
    return result;
  }, foregroundToken);
}

async function themeContext(
  browser: Browser,
  values: { colorTheme?: string; themeFamily?: string } = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    colorScheme: 'light',
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
    serviceWorkers: 'block',
  });
  await context.addInitScript((storedValues) => {
    localStorage.clear();
    if (storedValues.colorTheme !== undefined) {
      localStorage.setItem('colorTheme', storedValues.colorTheme);
    }
    if (storedValues.themeFamily !== undefined) {
      localStorage.setItem('themeFamily', storedValues.themeFamily);
    }
  }, values);
  return context;
}

async function mountThemePrimitives(page: Page) {
  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Button } = await import('/src/components/ui/button.tsx');
    const { Dialog, DialogContent, DialogTitle } = await import('/src/components/ui/dialog.tsx');

    const host = document.createElement('div');
    host.id = 'theme-contract-probe';
    document.body.appendChild(host);
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Button,
          { 'data-testid': 'destructive-button', variant: 'destructive' },
          'Delete',
        ),
        React.createElement(
          Dialog,
          { open: true },
          React.createElement(
            DialogContent,
            { showCloseButton: false },
            React.createElement(DialogTitle, null, 'Theme contract probe'),
          ),
        ),
      ),
    );
  });
  await expect(page.getByTestId('destructive-button')).toBeVisible();
  await expect(page.locator('[data-slot="dialog-overlay"]')).toBeVisible();
}

async function mountDestructivePrimitives(page: Page) {
  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Badge } = await import('/src/components/ui/badge.tsx');
    const { Button } = await import('/src/components/ui/button.tsx');
    const {
      DropdownMenu,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuTrigger,
    } = await import('/src/components/ui/dropdown-menu.tsx');

    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;top:1rem;left:1rem;z-index:2000;display:flex;align-items:center;gap:0.5rem';
    document.body.appendChild(host);
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Button,
          { 'data-testid': 'destructive-state-button', variant: 'destructive' },
          'Delete',
        ),
        React.createElement(
          Button,
          { 'aria-invalid': true, 'data-testid': 'invalid-button' },
          'Invalid',
        ),
        React.createElement(
          Badge,
          { asChild: true, variant: 'destructive' },
          React.createElement('a', { 'data-testid': 'destructive-badge', href: '#delete' }, 'Delete'),
        ),
        React.createElement(
          DropdownMenu,
          { modal: false, open: true },
          React.createElement(
            DropdownMenuTrigger,
            { asChild: true },
            React.createElement('button', null, 'Actions'),
          ),
          React.createElement(
            DropdownMenuContent,
            null,
            React.createElement(
              DropdownMenuItem,
              { 'data-testid': 'destructive-menu-item', variant: 'destructive' },
              'Delete',
            ),
          ),
        ),
      ),
    );
  });
  await expect(page.getByTestId('destructive-state-button')).toBeVisible();
  await expect(page.getByTestId('destructive-badge')).toBeVisible();
  await expect(page.getByTestId('destructive-menu-item')).toBeVisible();
}

async function mountInvalidFields(page: Page) {
  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Checkbox } = await import('/src/components/ui/checkbox.tsx');
    const { Input } = await import('/src/components/ui/input.tsx');
    const { Select, SelectTrigger, SelectValue } = await import('/src/components/ui/select.tsx');
    const { Textarea } = await import('/src/components/ui/textarea.tsx');

    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;top:1rem;left:1rem;z-index:2000;display:grid;gap:0.5rem;width:20rem';
    document.body.appendChild(host);
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Input, { 'aria-invalid': true, 'data-testid': 'invalid-input' }),
        React.createElement(Textarea, { 'aria-invalid': true, 'data-testid': 'invalid-textarea' }),
        React.createElement(Checkbox, { 'aria-invalid': true, 'data-testid': 'invalid-checkbox' }),
        React.createElement(
          Select,
          null,
          React.createElement(
            SelectTrigger,
            { 'aria-invalid': true, 'data-testid': 'invalid-select' },
            React.createElement(SelectValue, { placeholder: 'Choose' }),
          ),
        ),
      ),
    );
  });
  for (const testId of ['invalid-input', 'invalid-textarea', 'invalid-checkbox', 'invalid-select']) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
}

test('defaults to the Liquefy family and preserves the colorTheme contract', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('colorTheme'))).toBe('dark');

  await context.close();
});

test('applies a saved Liquefy theme before the app becomes interactive', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');

  await context.close();
});

test('normalizes a saved modern family to Liquefy before the app becomes interactive', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'modern' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');

  await context.close();
});

test('invalid persisted values fall back without breaking the document theme', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'sepia', themeFamily: 'missing' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#eefbff');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');
  expect(await page.evaluate(() => localStorage.getItem('colorTheme'))).toBe('auto');

  await context.close();
});

test('the footer theme menu commits family and color changes atomically', async ({ browser }) => {
  const context = await themeContext(browser);
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('主题', { exact: true }).click();
  await page.getByRole('menuitem', { name: '液态玻璃', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');
  await page.getByRole('menuitem', { name: '液态玻璃', exact: true }).waitFor({ state: 'hidden' });

  await page.getByLabel('主题', { exact: true }).click();
  await page.getByRole('menuitem', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(
    await page.evaluate(() => ({
      colorTheme: localStorage.getItem('colorTheme'),
      themeFamily: localStorage.getItem('themeFamily'),
    })),
  ).toEqual({ colorTheme: 'dark', themeFamily: 'liquefy' });

  await context.close();
});

test('the first-paint script restores generic theme state without a catalog or Bootstrap', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'future-theme' });
  const page = await context.newPage();
  await page.route('**/src/main.tsx*', (route) => route.abort());
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'future-theme');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-bs-theme', /.+/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(0);

  await context.close();
});

test('the semantic contract is framework-neutral and framework adapters stay separate', async () => {
  const [contract, tailwindAdapter, liquefyTheme] = await Promise.all([
    readFile('src/styles/theme/contract.css', 'utf8'),
    readFile('src/styles/theme/tailwind-adapter.css', 'utf8').catch(() => ''),
    readFile('src/styles/theme/liquefy.css', 'utf8'),
  ]);

  expect(contract).toContain('--ui-background');
  expect(contract).toContain('--ui-overlay');
  expect(contract).not.toContain('@theme');
  expect(contract).not.toContain('@custom-variant');
  expect(tailwindAdapter).toContain('@theme');
  expect(tailwindAdapter).toContain('var(--ui-background)');
  expect(liquefyTheme).not.toMatch(/--bs-[\w-]+\s*:/);
});

test('every theme resolves the complete semantic contract without missing values or cycles', async ({
  browser,
}) => {
  const contract = await readFile('src/styles/theme/contract.css', 'utf8');
  const contractTokens = [...new Set(contract.match(/--ui-[\w-]+/g) ?? [])].sort();
  expect(contractTokens.length).toBeGreaterThan(100);

  for (const themeFamily of ['legacy', 'liquefy', 'animal-island']) {
    for (const colorTheme of ['light', 'dark']) {
      const context = await themeContext(browser, { colorTheme, themeFamily });
      const page = await context.newPage();
      await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
      const missingTokens = await page.evaluate((tokens) => {
        const styles = getComputedStyle(document.documentElement);
        return tokens.filter((token) => styles.getPropertyValue(token).trim() === '');
      }, contractTokens);
      expect(missingTokens, `${themeFamily}/${colorTheme}`).toEqual([]);
      await context.close();
    }
  }
});

test('the theme menu renders one theme-neutral component contract', async ({ browser }) => {
  async function menuClasses(themeFamily: 'legacy' | 'liquefy' | 'animal-island') {
    const context = await themeContext(browser, { colorTheme: 'dark', themeFamily });
    const page = await context.newPage();
    await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
    const trigger = page.getByLabel('主题', { exact: true });
    await trigger.click();
    const result = {
      content: await page.getByRole('menu').getAttribute('class'),
      item: await page.getByRole('menuitem', { name: '自动', exact: true }).getAttribute('class'),
      trigger: await trigger.getAttribute('class'),
    };
    await context.close();
    return result;
  }

  expect(await menuClasses('legacy')).toEqual(await menuClasses('liquefy'));
});

test('theme menu label presentation comes from semantic tokens', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-theme-menu-label-padding-block', '1px 3px');
    root.style.setProperty('--ui-theme-menu-label-padding-inline', '4px 2px');
    root.style.setProperty('--ui-theme-menu-label-font-size', '17px');
    root.style.setProperty('--ui-theme-menu-label-font-weight', '432');
  });
  await page.getByLabel('主题', { exact: true }).click();

  const label = page.getByRole('menu').locator('[data-slot="dropdown-menu-label"]').first();
  await expect(label).toHaveCSS('padding', '1px 2px 3px 4px');
  await expect(label).toHaveCSS('font-size', '17px');
  await expect(label).toHaveCSS('font-weight', '432');

  await context.close();
});

test('Liquefy theme menu surfaces and item states remain controlled by semantic menu tokens', async ({
  browser,
}) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-theme-menu-background', 'rgb(1 2 3)');
    root.style.setProperty('--ui-theme-menu-border', 'rgb(4 5 6)');
    root.style.setProperty('--ui-theme-menu-radius', '7px');
    root.style.setProperty('--ui-theme-menu-shadow', 'none');
    root.style.setProperty('--ui-theme-menu-item-hover', 'rgb(7 8 9)');
  });
  await page.getByLabel('主题', { exact: true }).click();

  const menu = page.getByRole('menu');
  await expect(menu).toHaveCSS('background-color', 'rgb(1, 2, 3)');
  await expect(menu).toHaveCSS('border-color', 'rgb(4, 5, 6)');
  await expect(menu).toHaveCSS('border-radius', '7px');
  await expect(menu).toHaveCSS('box-shadow', 'none');
  const legacyItem = menu.getByRole('menuitem', { name: '经典', exact: true });
  await legacyItem.hover();
  await expect(legacyItem).toHaveCSS('background-color', 'rgb(7, 8, 9)');

  await context.close();
});

test('shadcn primitives consume destructive and overlay semantic tokens', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--ui-destructive', '#123456');
    document.documentElement.style.setProperty('--ui-destructive-foreground', '#fedcba');
    document.documentElement.style.setProperty('--ui-overlay', 'rgb(1 2 3 / 25%)');
  });
  await mountThemePrimitives(page);

  await expect(page.getByTestId('destructive-button')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await expect(page.getByTestId('destructive-button')).toHaveCSS('color', 'rgb(254, 220, 186)');
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCSS(
    'background-color',
    'rgba(1, 2, 3, 0.25)',
  );

  await context.close();
});

test('destructive and invalid interactions consume final theme-owned semantic colors', async ({
  browser,
}) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-destructive-control-hover-background', 'rgb(10 20 30)');
    root.style.setProperty('--ui-destructive-subtle', 'rgb(40 50 60)');
    root.style.setProperty('--ui-focus-ring', 'rgb(70 80 90)');
  });
  await mountDestructivePrimitives(page);

  const button = page.getByTestId('destructive-state-button');
  await button.focus();
  await expect(button).toHaveCSS('outline-color', 'rgb(70, 80, 90)');

  const invalidButton = page.getByTestId('invalid-button');
  await invalidButton.focus();
  await expect(invalidButton).toHaveCSS('outline-color', 'rgb(70, 80, 90)');

  await button.hover();
  await expect(button).toHaveCSS('background-color', 'rgb(10, 20, 30)');

  const badge = page.getByTestId('destructive-badge');
  await badge.hover();
  await expect(badge).toHaveCSS('background-color', 'rgb(10, 20, 30)');

  const menuItem = page.getByTestId('destructive-menu-item');
  await menuItem.focus();
  await expect(menuItem).toHaveCSS('background-color', 'rgb(40, 50, 60)');

  await context.close();
});

test('Liquefy invalid fields preserve the semantic invalid border while focused', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-invalid', 'rgb(10 20 30)');
    root.style.setProperty('--ui-destructive', 'rgb(40 50 60)');
  });
  await mountInvalidFields(page);

  for (const testId of ['invalid-input', 'invalid-textarea', 'invalid-checkbox', 'invalid-select']) {
    const field = page.getByTestId(testId);
    await expect(field).toHaveCSS('border-color', 'rgb(10, 20, 30)');
    await field.focus();
    await expect(field).toHaveCSS('border-color', 'rgb(10, 20, 30)');
  }

  await context.close();
});

test('Legacy invalid field focus uses the final semantic focus color', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-focus-ring', 'rgb(70 80 90)');
    root.style.setProperty('--ui-destructive', 'rgb(10 20 30)');
  });
  await mountInvalidFields(page);

  for (const testId of ['invalid-input', 'invalid-textarea', 'invalid-checkbox', 'invalid-select']) {
    const field = page.getByTestId(testId);
    await field.focus();
    await expect(field).toHaveCSS('box-shadow', /rgb\(70, 80, 90\)/);
  }

  await context.close();
});

test('shadcn focus rings consume the final semantic ring color without recompositing it', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.documentElement.style.setProperty('--ui-focus-ring', 'rgb(1 2 3 / 25%)');
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Button } = await import('/src/components/ui/button.tsx');
    const host = document.createElement('div');
    document.body.appendChild(host);
    createRoot(host).render(React.createElement(Button, { 'data-testid': 'focus-button' }, 'Focus'));
  });
  const button = page.getByTestId('focus-button');
  await button.focus();

  await expect(button).toHaveCSS('box-shadow', /rgba\(1, 2, 3, 0\.25\)/);

  await context.close();
});

test('focus indicators keep at least 3:1 contrast in every theme', async ({ browser }) => {
  for (const themeFamily of ['legacy', 'liquefy', 'animal-island']) {
    for (const colorTheme of ['light', 'dark']) {
      const context = await themeContext(browser, { colorTheme, themeFamily });
      const page = await context.newPage();
      await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
      const colors = await semanticColors(page, '--ui-focus-ring');
      expect(
        contrastAgainstBackground(colors.foreground, colors.background),
        `${themeFamily}/${colorTheme}`,
      ).toBeGreaterThanOrEqual(3);
      await context.close();
    }
  }
});

test('Legacy muted foreground retains readable Bootstrap secondary contrast', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const text = document.createElement('span');
    text.className = 'text-muted-foreground';
    text.dataset.testid = 'muted-text';
    text.textContent = 'Readable description';
    document.body.appendChild(text);
  });

  await expect(page.getByTestId('muted-text')).toHaveCSS('color', 'rgba(33, 37, 41, 0.75)');

  await context.close();
});

test('Liquefy muted foreground keeps normal text contrast in light mode', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  const colors = await semanticColors(page, '--ui-muted-foreground');
  expect(contrastAgainstBackground(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  await context.close();
});

test('Bootstrap colors are compatibility aliases of the semantic contract', async ({ browser }) => {
  for (const themeFamily of ['legacy', 'liquefy', 'animal-island']) {
    const context = await themeContext(browser, { colorTheme: 'light', themeFamily });
    const page = await context.newPage();
    await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--ui-destructive', '#123456');
      document.documentElement.style.setProperty('--ui-destructive-foreground', '#fedcba');
      document.documentElement.style.setProperty('--ui-destructive-control-background', '#123456');
      const button = document.createElement('button');
      button.className = 'btn btn-danger';
      button.dataset.testid = 'bootstrap-danger';
      button.textContent = 'Delete';
      document.body.appendChild(button);
    });

    await expect(page.getByTestId('bootstrap-danger')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await expect(page.getByTestId('bootstrap-danger')).toHaveCSS('color', 'rgb(254, 220, 186)');

    await context.close();
  }
});

test('Bootstrap backdrops render the final semantic overlay color once', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--ui-overlay', 'rgb(1 2 3 / 25%)');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade show';
    backdrop.dataset.testid = 'bootstrap-backdrop';
    document.body.appendChild(backdrop);
  });

  const backdrop = page.getByTestId('bootstrap-backdrop');
  await expect(backdrop).toHaveCSS('background-color', 'rgba(1, 2, 3, 0.25)');
  await expect(backdrop).toHaveCSS('opacity', '1');

  await context.close();
});

test('the legacy theme menu uses the same family-over-color layout as Liquefy', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('主题', { exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByText('界面风格', { exact: true })).toBeVisible();
  await expect(menu.getByText('明暗模式', { exact: true })).toBeVisible();
  await expect(menu.getByRole('separator')).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: '经典', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '液态玻璃', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '动物朋友', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '自动', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '浅色', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '深色', exact: true })).toHaveClass(/active/);

  await context.close();
});

test('Animal Friends restores its palette and native component adapters', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'light',
    themeFamily: 'animal-island',
  });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'animal-island');
  await expect(page.locator('html')).toHaveClass(/animal-cursor--force/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f8f8f0');

  const cursor = await page.locator('html').evaluate((element) => getComputedStyle(element).cursor);
  expect(cursor).toContain('data:image/svg+xml');

  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Card, CardContent } = await import('/src/components/ui/card.tsx');
    const { Button } = await import('/src/components/ui/button.tsx');
    const { BModal } = await import('/src/components/shared/BModal.tsx');
    const { Pagination } = await import('/src/components/shared/Pagination.tsx');

    const host = document.createElement('div');
    document.body.appendChild(host);
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Button, { 'data-testid': 'animal-button' }, 'Island action'),
        React.createElement(
          Card,
          { 'data-testid': 'animal-card' },
          React.createElement(CardContent, null, 'Island card'),
        ),
        React.createElement(Pagination, {
          current: 1,
          pageSize: 10,
          totalItems: 30,
          onPageChange: () => undefined,
        }),
        React.createElement(BModal, {
          open: true,
          onClose: () => undefined,
          title: 'Island modal',
          children: 'Island body',
        }),
      ),
    );
  });

  await expect(page.getByTestId('animal-button')).toHaveClass(/animal-island-button/);
  await expect(page.getByTestId('animal-card')).toHaveClass(/animal-island-card/);
  await expect(page.locator('.animal-island-pagination')).toBeVisible();
  await expect(page.locator('.animal-island-modal')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Island body');
  await expect(page.locator('.animal-island-modal')).toHaveCSS('outline-style', 'none');

  await page.evaluate(async () => {
    const { setTheme } = await import('/src/lib/theme.ts');
    setTheme({ family: 'liquefy' });
  });
  await expect(page.locator('html')).not.toHaveClass(/animal-cursor--force/);

  await context.close();
});

test('Animal Friends importer keeps native surfaces readable in dark mode', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'dark',
    themeFamily: 'animal-island',
  });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { ImporterPage } = await import('/src/pages/ImporterPage.tsx');
    const host = document.createElement('div');
    host.id = 'importer-dark-probe';
    document.body.appendChild(host);
    createRoot(host).render(React.createElement(ImporterPage));
  });

  await expect(page.locator('#importer-dark-probe .animal-island-import-panel')).toHaveCount(3);
  const styles = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('#importer-dark-probe .animal-island-import-panel');
    const warning = document.querySelector<HTMLElement>('#importer-dark-probe .animal-island-import-warning');
    const button = panel?.querySelector<HTMLElement>('[class*="animal-btn-primary-"]');
    const warningTitle = warning?.querySelector<HTMLElement>('strong');
    const warningContent = warning?.querySelector<HTMLElement>('span');
    return {
      panelBackground: panel ? getComputedStyle(panel).backgroundColor : '',
      panelColor: panel ? getComputedStyle(panel).color : '',
      warningBackground: warning ? getComputedStyle(warning).backgroundColor : '',
      warningColor: warning ? getComputedStyle(warning).color : '',
      warningTitleColor: warningTitle ? getComputedStyle(warningTitle).color : '',
      warningContentColor: warningContent ? getComputedStyle(warningContent).color : '',
      buttonBackground: button ? getComputedStyle(button).backgroundColor : '',
      buttonColor: button ? getComputedStyle(button).color : '',
    };
  });

  expect(styles.panelBackground).toBe('rgb(52, 47, 37)');
  expect(styles.panelColor).toBe('rgb(234, 223, 201)');
  expect(styles.warningBackground).toBe('rgb(81, 68, 31)');
  expect(styles.warningColor).toBe('rgb(255, 225, 151)');
  expect(styles.warningTitleColor).toBe('rgb(255, 225, 151)');
  expect(styles.warningContentColor).toBe('rgb(255, 225, 151)');
  expect(styles.buttonBackground).toBe('rgb(98, 216, 201)');
  expect(styles.buttonColor).toBe('rgb(44, 42, 34)');

  await context.close();
});

test('Animal Friends bridges RinNET notices to themed native cards', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'light',
    themeFamily: 'animal-island',
  });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.evaluate(async () => {
    const { notice } = await import('/src/lib/message.ts');
    notice('Island notification', 'success');
  });

  const notification = page.locator('.animal-island-toast');
  await expect(notification).toContainText('Island notification');
  await expect(notification).toHaveAttribute('role', 'alert');

  await context.close();
});

test('search-param pagination does not key route contents by history entry', async () => {
  const shellSource = await readFile(
    new URL('../../src/components/shell/AppShell.tsx', import.meta.url),
    'utf8',
  );

  expect(shellSource).toContain('key={location.pathname}');
  expect(shellSource).not.toContain('key={location.key}');
});

test('game-specific pagination uses the Animal Friends component adapter', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'light',
    themeFamily: 'animal-island',
  });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { OngekiPagination } = await import('/src/features/ongeki/OngekiPagination.tsx');
    const { ChuniV2Pagination } = await import('/src/features/chuni/ChuniV2Pagination.tsx');
    const { Maimai2Pagination } = await import('/src/features/mai2/Maimai2Pagination.tsx');
    const components = [OngekiPagination, ChuniV2Pagination, Maimai2Pagination];

    const host = document.createElement('div');
    document.body.appendChild(host);
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        ...components.map((Component, index) =>
          React.createElement(Component, {
            current: 1,
            key: index,
            onPageChange: () => undefined,
            pageSize: 10,
            totalItems: 80,
          }),
        ),
      ),
    );
  });

  await expect(page.locator('.animal-island-pagination')).toHaveCount(3);

  await context.close();
});

test('Animal Friends keeps shell gutters and responsive admin controls usable', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'light',
    themeFamily: 'animal-island',
  });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  const headerGutters = await page.locator('.app-navbar').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: window.innerWidth - rect.right };
  });
  expect(headerGutters.left).toBeGreaterThan(0);
  expect(Math.abs(headerGutters.left - headerGutters.right)).toBeLessThanOrEqual(1);

  const controls = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div class="table-responsive" data-testid="responsive-table" style="width: 240px">
        <div style="width: 720px;height:20px"></div>
      </div>
      <button class="btn btn-outline-danger" data-testid="delete-save">删除存档</button>
      <button class="btn btn-close cards-unbind-button" data-testid="unbind-card"></button>
    `;
    document.body.appendChild(host);
    const responsive = host.querySelector<HTMLElement>('[data-testid="responsive-table"]')!;
    const destructive = host.querySelector<HTMLElement>('[data-testid="delete-save"]')!;
    const close = host.querySelector<HTMLElement>('[data-testid="unbind-card"]')!;
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      closeBackground: getComputedStyle(close).backgroundColor,
      destructiveBorder: getComputedStyle(destructive).borderColor,
      destructiveToken: rootStyle.getPropertyValue('--ui-destructive').trim(),
      overflowX: getComputedStyle(responsive).overflowX,
      overflowY: getComputedStyle(responsive).overflowY,
      scrollable: responsive.scrollWidth > responsive.clientWidth,
    };
  });

  expect(controls.overflowX).toBe('auto');
  expect(controls.overflowY).toBe('hidden');
  expect(controls.scrollable).toBeTruthy();
  expect(controls.destructiveBorder).toBe('rgb(224, 90, 90)');
  expect(controls.destructiveToken).toBe('#e05a5a');
  expect(controls.closeBackground).toBe('rgb(224, 90, 90)');

  await context.close();
});

test('Legacy mobile header spans the viewport instead of shrinking to its contents', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'dark',
    themeFamily: 'legacy',
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${REACT_ORIGIN}/import`, { waitUntil: 'domcontentloaded' });

  const geometry = await page.locator('.app-navbar').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: window.innerWidth - rect.right, width: rect.width };
  });

  expect(geometry.left).toBe(0);
  expect(geometry.right).toBe(0);
  expect(geometry.width).toBe(390);

  await context.close();
});

test('Animal Friends mobile navigation animates in and out', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'light',
    themeFamily: 'animal-island',
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${REACT_ORIGIN}/import`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { accountStore } = await import('/src/lib/auth/account.ts');
    accountStore.set({ accessToken: 'test', refreshToken: 'test', tokenType: 'Bearer' });
  });

  await page.getByRole('button', { name: '导航' }).click();
  const drawer = page.locator('.shell-mobile-animal-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS('animation-name', 'animal-island-drawer-in');
  await expect(drawer).toHaveCSS('animation-duration', '0.36s');

  await page.getByRole('button', { name: '关闭' }).click();
  await expect(drawer).toHaveClass(/is-closing/);
  await expect(drawer).toHaveCSS('animation-name', 'animal-island-drawer-out');
  await expect(drawer).toHaveCount(0, { timeout: 1_000 });

  await context.close();
});

test('Animal Friends dark mobile navigation uses the dark panel palette', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'dark',
    themeFamily: 'animal-island',
  });
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${REACT_ORIGIN}/import`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const { accountStore } = await import('/src/lib/auth/account.ts');
    accountStore.set({ accessToken: 'test', refreshToken: 'test', tokenType: 'Bearer' });
  });
  await page.getByRole('button', { name: '导航' }).click();

  const palette = await page.locator('.shell-mobile-animal-drawer').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      color: style.color,
      expectedBackground: getComputedStyle(document.documentElement)
        .getPropertyValue('--ui-card')
        .trim(),
    };
  });

  expect(palette.background).toBe('rgb(52, 47, 37)');
  expect(palette.color).toBe('rgb(234, 223, 201)');
  expect(palette.background).not.toBe('rgb(247, 243, 223)');
  expect(palette.expectedBackground).toBe('#342f25');

  await context.close();
});

test('modern Mai surfaces keep jacket art centered and use the Animal palette', async ({ browser }) => {
  const context = await themeContext(browser, {
    colorTheme: 'dark',
    themeFamily: 'animal-island',
  });
  const page = await context.newPage();
  await page.goto(`${REACT_ORIGIN}/mai2/songlist`, { waitUntil: 'domcontentloaded' });

  const styles = await page.evaluate(() => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div data-theme="liquefy">
        <div class="maimai2-song-list-page">
          <div class="song-info">
            <div class="jacket-container ratio ratio-1x1 position-relative">
              <img class="position-absolute rounded-start" alt="liquefy probe" />
            </div>
          </div>
        </div>
      </div>
      <div class="maimai2-song-list-page">
        <div class="song-info">
          <div class="jacket-container ratio ratio-1x1 position-relative">
            <img class="position-absolute rounded-start" alt="animal probe" />
          </div>
        </div>
      </div>
      <div class="maimai2-song-detail">
        <div class="card-body">probe</div>
      </div>
      <div data-theme="liquefy">
        <div class="maimai2-song-detail">
          <div class="card-body">liquefy probe</div>
        </div>
      </div>
      <div class="announcement-detail-dialog">
        <div class="animal-header-probe"><div class="animal-title-probe">公告</div></div>
      </div>
    `;
    document.body.appendChild(host);
    const jacketContainer = host.querySelector<HTMLElement>('.maimai2-song-list-page .jacket-container')!;
    const jacket = host.querySelector<HTMLImageElement>('.maimai2-song-list-page .jacket-container img')!;
    const liquefyJacketContainer = host.querySelector<HTMLElement>('[data-theme="liquefy"] .jacket-container')!;
    const scoreBody = host.querySelector<HTMLElement>('.maimai2-song-detail .card-body')!;
    const liquefyScoreBody = host.querySelector<HTMLElement>('[data-theme="liquefy"] .maimai2-song-detail .card-body')!;
    const announcementHeader = host.querySelector<HTMLElement>('.animal-header-probe')!;
    const jacketStyle = getComputedStyle(jacket);
    const result = {
      jacketPosition: jacketStyle.position,
      jacketInset: [jacketStyle.top, jacketStyle.right, jacketStyle.bottom, jacketStyle.left],
      jacketDisplay: getComputedStyle(jacketContainer).display,
      jacketAlignItems: getComputedStyle(jacketContainer).alignItems,
      jacketJustifyContent: getComputedStyle(jacketContainer).justifyContent,
      jacketOverflow: getComputedStyle(jacketContainer).overflow,
      liquefyJacketDisplay: getComputedStyle(liquefyJacketContainer).display,
      liquefyJacketAlignItems: getComputedStyle(liquefyJacketContainer).alignItems,
      liquefyJacketJustifyContent: getComputedStyle(liquefyJacketContainer).justifyContent,
      liquefyJacketOverflow: getComputedStyle(liquefyJacketContainer).overflow,
      scoreBodyBackground: getComputedStyle(scoreBody).backgroundColor,
      liquefyScoreBodyBackground: getComputedStyle(liquefyScoreBody).backgroundColor,
      announcementHeaderBackground: getComputedStyle(announcementHeader).backgroundColor,
    };
    host.remove();
    return result;
  });

  expect(styles.jacketPosition).toBe('absolute');
  expect(styles.jacketInset).toEqual(['0px', '0px', '0px', '0px']);
  expect(styles.jacketDisplay).toBe('flex');
  expect(styles.jacketAlignItems).toBe('center');
  expect(styles.jacketJustifyContent).toBe('center');
  expect(styles.jacketOverflow).toBe('hidden');
  expect(styles.liquefyJacketDisplay).toBe('flex');
  expect(styles.liquefyJacketAlignItems).toBe('center');
  expect(styles.liquefyJacketJustifyContent).toBe('center');
  expect(styles.liquefyJacketOverflow).toBe('hidden');
  expect(styles.scoreBodyBackground).toBe('rgba(0, 0, 0, 0)');
  expect(styles.liquefyScoreBodyBackground).toBe('rgba(0, 0, 0, 0)');
  expect(styles.announcementHeaderBackground).toBe('rgba(0, 0, 0, 0)');

  await context.close();
});
