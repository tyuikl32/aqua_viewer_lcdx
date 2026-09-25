import type { Page } from '@playwright/test';

export const user = {
  username: '123456',
  roles: [],
  cards: [{ default: true, extId: '100', luid: '12345678901234567890' }],
  defaultCard: { extId: '100', luid: '12345678901234567890' },
};
export const ok = (data: unknown) => ({ status: { code: 92001 }, data });

export async function setup(page: Page, permission = 10, cached = true, authenticated = true) {
  const requests: string[] = [];
  await page.addInitScript(({ user, cached, authenticated }) => {
    if (authenticated) {
      localStorage.setItem('currentAccount', JSON.stringify({
        tokenType: 'Bearer',
        accessToken: 'offline-test',
        refreshToken: 'offline-refresh',
      }));
    }
    if (cached) localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('lang', 'en');
    localStorage.setItem('dbVersion', '1');
  }, { user, cached, authenticated });

  // Never allow test fixtures or fake tokens to reach any external service.
  await page.context().route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:5187') return route.abort();
    if (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/lcdx/')) {
      return route.continue();
    }
    requests.push(url.pathname + url.search);
    let data: unknown = null;
    if (url.pathname === '/api/user/me') data = user;
    else if (url.pathname === '/api/account/status') data = { banned: false, appeal: '' };
    else if (url.pathname.includes('/permission/')) data = { permission, qqNumber: 123456 };
    else if (url.pathname.includes('/manage-access/')) data = { hasManage: permission > 0 };
    else if (url.pathname.includes('/controllable/')) {
      data = [
        { nickName: 'Cabinet A', fullKeychip: 'A' },
        { nickName: 'Cabinet B', fullKeychip: 'B' },
      ];
    } else if (url.pathname.includes('/grants/') || url.pathname.includes('/permissions/')) {
      data = { items: [], total: 0 };
    } else if (url.pathname.includes('/locks/')) {
      data = { items: [], total: 45 };
    }
    if (url.pathname.includes('/version')) {
      return route.fulfill({ json: { version: { major: 1 } } });
    }
    return route.fulfill({ json: ok(data) });
  });
  return requests;
}
