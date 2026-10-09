import { expect, test } from '@playwright/test';

const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://127.0.0.1:5173';

test.use({ ignoreHTTPSErrors: true });

test('card pick coordinates stay in the viewport when Liquefy route motion transforms an ancestor', async ({ page }) => {
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const { findFixedPositioningContext, toFixedPositionPoint } = await import(
      '/src/features/ongeki/card-pick-position.ts'
    );

    document.body.innerHTML = `
      <div id="route" style="position: relative; transform: translateY(0); margin: 80px 0 0 120px; width: 700px; height: 400px;">
        <div id="card" style="position: fixed; width: 100px; height: 200px; transform: translate(-50%, -50%);"></div>
      </div>
    `;
    const card = document.querySelector<HTMLElement>('#card')!;
    const context = findFixedPositioningContext(card);
    const point = toFixedPositionPoint(
      { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      context,
    );
    card.style.left = `${point.left}px`;
    card.style.top = `${point.top}px`;
    const rect = card.getBoundingClientRect();
    return {
      context: context?.id ?? null,
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      viewport: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    };
  });

  expect(result.context).toBe('route');
  expect(result.center.x).toBeCloseTo(result.viewport.x, 1);
  expect(result.center.y).toBeCloseTo(result.viewport.y, 1);
});
