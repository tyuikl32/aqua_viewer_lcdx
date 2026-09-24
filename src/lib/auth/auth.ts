import { api } from '@/lib/api/client';
import { lcdx } from '@/lib/api/client';
import { StatusCode } from '@/lib/models';
import { navigate } from '@/lib/nav';
import { setAccount, clearAccount, getAccount } from '@/lib/auth/account';
import { restoreAccess, clearAccess } from '@/lib/auth/access';
import { loadUser, clearUser, getCurrentUser } from '@/lib/user';

/** 等价旧版 authentication.service.ts */

/** 等价旧版 procLoginResp：登录成功后设置 token、检查封禁/EULA、加载用户 */
export async function procLoginResp(loginResp: any): Promise<any> {
  const loginStatusCode: number = loginResp?.status?.code;
  if (loginStatusCode !== StatusCode.OK || !loginResp.data) {
    return loginResp;
  }
  setAccount(loginResp.data);
  const status = await restoreAccess(true);
  if (status?.banned) {
    navigate('/banned');
    return loginResp;
  }
  if (status?.eulaRequired) {
    navigate('/eula');
    return loginResp;
  }
  const userResp = await loadUser(true);
  // LCDX：无卡用户引导至网络码绑定页（等价旧版 procLoginResp 的 cards.length===0 分支）
  if (userResp?.status?.code === StatusCode.OK && getCurrentUser()?.cards?.length === 0) {
    navigate('/netcode-bind');
  }
  return loginResp;
}

export function login(usernameOrEmail: string, password: string, token?: string): Promise<any> {
  const params: any = { usernameOrEmail, password };
  if (token) {
    params.oAuth2Token = token;
  }
  return api.post('api/auth/signin', params).then(procLoginResp);
}

export function loginWithTotp(totpToken: string, code: string): Promise<any> {
  return api.post('api/auth/signin/totp', { totpToken, code }).then(procLoginResp);
}

export function loginAs(username: string): Promise<any> {
  return api.post(`api/admin/users/loginas/${username}`, {}).then(procLoginResp);
}

export function loginWithOAuth(oauthCode: string, type: string): Promise<any> {
  return api.post(`api/auth/signin/oauth2/${oauthCode}/${type}`).then(procLoginResp);
}

/** LCDX 一次性登录（等价旧版 login_lcdx：GET lcdx/onetime-v2/{token}） */
export function loginLcdxOnetime(token: string): Promise<any> {
  return lcdx.get(`lcdx/onetime-v2/${encodeURIComponent(token)}`).then(procLoginResp);
}

export function signUp(
  name: string,
  username: string,
  email: string,
  verifyCode: string,
  password: string,
  token?: string,
  eulaVersion?: number,
): Promise<any> {
  const params: any = { name, username, email, verifyCode, password, eulaVersion };
  if (token) {
    params.oAuth2Token = token;
  }
  return api.post('api/auth/signup', params).then(procLoginResp);
}

export function resetPassword(emailAddress: string, verifyCode: string, password: string): Promise<any> {
  return api.post('api/auth/resetPassword', { emailAddress, verifyCode, password });
}

export function getVerifyCode(email: string): Promise<any> {
  return api.post('api/auth/getVerifyCode', { email });
}

export function getResetPasswordCode(email: string): Promise<any> {
  return api.post('api/auth/getResetPasswordCode', { email });
}

export function checkUsernameAvailability(username: string): Promise<any> {
  return api.get('api/user/checkUsernameAvailability', { username });
}

export function checkEmailAvailability(email: string): Promise<any> {
  return api.get('api/user/checkEmailAvailability', { email });
}

export async function logout(): Promise<any> {
  // 服务端撤销 refresh token；无论成败都清理本地状态（与旧版一致）
  const refreshToken = getAccount()?.refreshToken;
  let resp: any = null;
  try {
    resp = await api.post('api/auth/signout', { refreshToken });
  } catch {
    resp = null;
  }
  clearAccount();
  clearUser();
  clearAccess();
  return resp;
}
