import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { translate } from '@/lib/i18n';

/** 等价旧版 oauth.service.ts */

export const tokenTypes = new Map<string, string>([
  ['bcn', 'BEMANICN'],
  ['microsoft', 'Microsoft'],
  ['github', 'GitHub'],
  ['gitlab', 'GitLab'],
]);

export function getSignInUrl(type: string): void {
  const state = generateRandomString();
  localStorage.setItem('oauth_state', state);

  void api
    .get(`api/auth/signin/oauth2/${type}`)
    .then((response: any) => {
      if (response?.data) {
        window.location.href = `${response.data}&state=${state}`;
      } else {
        console.error('Failed to get OAuth2 response data');
        notice(translate('OAuthPage.GetResponseFailed'));
      }
    })
    .catch((error) => {
      console.error('OAuth Sign In Error:', error);
      notice(translate('OAuthPage.SignInFailed'));
    });
}

export function generateRandomString(length = 16): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}
