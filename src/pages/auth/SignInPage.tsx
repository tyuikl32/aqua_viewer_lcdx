import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InfoCircleFill } from 'react-bootstrap-icons';
import './auth.css';
import { loginLcdx, loginWithTotp } from '@/lib/auth/auth';
import { StatusCode } from '@/lib/models';
import { notice } from '@/lib/message';

const QQ_PATTERN = /^\d{5,12}$/;
const TOTP_PATTERN = /^(\d{6}|[A-Za-z0-9]{5}-[A-Za-z0-9]{5})$/;

interface AuthNavState {
  qqNumber?: string;
}

/**
 * 等价旧版 sign-in.component（LCDX：QQ 号 + 密码 → POST lcdx/login，TOTP 二段验证）。
 * 与上游登录流的差异（LCDX 有意为之，勿合并回去）：账号为 QQ 号；无「用户名/邮箱」表单、
 * 无 Passkey、无 OAuth 入口 —— LCDX 后端以 `ResolveQQAsync(userName)` 定位用户，
 * 非 LCDX 账号（门户邮箱/OAuth/Passkey 账号）在机台等接口一律 401，故这些入口在本部署不可用。
 * 上游对应实现（OauthCallbackPage / PasswordResetPage / lib/auth/webauthn）保留在代码中，仅不再暴露入口。
 */
export function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as AuthNavState | null;

  const [qqNumber, setQqNumber] = useState(() => state?.qqNumber ?? '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ qqNumber: false, password: false, code: false });
  const [totpToken, setTotpToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 等价旧版 history.replaceState：清掉 nav state，避免刷新重复消费
  useState(() => {
    if (state) window.history.replaceState({}, document.title);
    return null;
  });

  const qqNumberValid = QQ_PATTERN.test(qqNumber);
  const totpCodeValid = TOTP_PATTERN.test(totpCode);

  function navigateToSignUp() {
    void navigate('/sign-up', { state: { qqNumber } });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!qqNumberValid || !password) {
      setTouched({ qqNumber: true, password: true, code: false });
      return;
    }
    setSubmitting(true);
    try {
      const resp = await loginLcdx(qqNumber, password);
      const statusCode: number = resp?.status?.code;
      if (statusCode === StatusCode.OK && resp.data) {
        notice(t('SignInPage.LoginSuccessMessage'));
        // 等价旧版 `if (router.url.startsWith('/sign-in'))`：无卡用户已被 procLoginResp
        // 送去 /netcode-bind，此处不得覆盖
        if (window.location.pathname.startsWith('/sign-in')) {
          await navigate('/dashboard');
        }
      } else if (statusCode === StatusCode.TOTP_REQUIRED && resp.data?.totpToken) {
        setTotpToken(resp.data.totpToken);
      } else if (statusCode === StatusCode.LOGIN_FAILED) {
        notice(t('SignInPage.LoginFailedMessage'), 'danger');
      } else {
        notice(t('SignInPage.LoginFailedMessage'));
      }
    } catch {
      notice(t('Common.OperationFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!totpCodeValid) {
      setTouched((s) => ({ ...s, code: true }));
      return;
    }
    setSubmitting(true);
    try {
      const resp = await loginWithTotp(totpToken!, totpCode);
      const statusCode: number = resp?.status?.code;
      if (statusCode === StatusCode.OK && resp.data) {
        notice(t('SignInPage.LoginSuccessMessage'));
        if (window.location.pathname.startsWith('/sign-in')) {
          await navigate('/dashboard');
        }
        return;
      }
      if (statusCode === StatusCode.TOTP_INVALID) {
        notice(t('SignInPage.TotpInvalidMessage'), 'danger');
      } else if (statusCode === StatusCode.TOTP_TOO_MANY_ATTEMPTS) {
        setTotpToken(null);
        notice(t('SignInPage.TotpLockedMessage'), 'danger');
      } else {
        setTotpToken(null);
        notice(t('SignInPage.LoginFailedMessage'));
      }
      setTotpCode('');
    } catch {
      notice(t('Common.OperationFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  function cancelTotp() {
    setTotpToken(null);
    setTotpCode('');
  }

  return (
    <div className="d-flex justify-content-center px-2">
      <div className="card authorization-card col-12 mb-5">
        <div className="alert alert-info d-flex gap-2 m-2 mb-0" role="alert">
          <InfoCircleFill className="flex-shrink-0 mt-1" />
          <div>
            <div>{t('SignInPage.BotQuickLoginTip')}</div>
            <div>{t('SignInPage.ManualLoginTip')}</div>
          </div>
        </div>

        <div className="pt-3 pt-lg-4 px-3 px-sm-5 mb-3">
          <div className="mb-4">
            <div className="fs-1 fw-bold">NET</div>
            <div className="fs-5 fw-bold">{t('SignInPage.Title')}</div>
          </div>

          {totpToken ? (
            <form onSubmit={(e) => void onSubmitTotp(e)}>
              <div className="d-grid gap-2 small fw-bold">
                <p className="fw-normal mb-2">{t('SignInPage.TotpTip')}</p>
                <div>
                  <label htmlFor="totpCode" className="form-label small">
                    {t('SignInPage.TotpCode')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={11}
                    autoFocus
                    className={'form-control form-control-sm' + (touched.code && !totpCodeValid ? ' is-invalid' : '')}
                    id="totpCode"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    onBlur={() => setTouched((s) => ({ ...s, code: true }))}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {t('SignInPage.SignIn')}
                </button>
                <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={cancelTotp}>
                  {t('SignInPage.TotpBack')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)}>
              <div className="d-grid gap-2 small fw-bold">
                <div>
                  <label htmlFor="qqNumber" className="form-label small">
                    {t('SignInPage.UsernameOrEmail')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="username"
                    className={'form-control form-control-sm' + (touched.qqNumber && !qqNumberValid ? ' is-invalid' : '')}
                    id="qqNumber"
                    value={qqNumber}
                    onChange={(e) => setQqNumber(e.target.value)}
                    onBlur={() => setTouched((s) => ({ ...s, qqNumber: true }))}
                  />
                  {touched.qqNumber && !qqNumberValid && (
                    <div className="invalid-feedback">{t('SignInPage.QQNumberInvalid')}</div>
                  )}
                </div>
                <div>
                  <label htmlFor="password" className="form-label small">
                    {t('SignInPage.Password')}
                  </label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    className={'form-control form-control-sm' + (touched.password && !password ? ' is-invalid' : '')}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                  />
                </div>
                <div className="text-end">
                  <button type="button" className="btn btn-link text-decoration-none btn-sm" onClick={navigateToSignUp}>
                    {t('SignInPage.ResetPasswordTip')}
                  </button>
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {t('SignInPage.SignIn')}
                </button>
                <div className="fw-normal d-flex align-items-center justify-content-center gap-1">
                  {t('SignInPage.SignUpTip')}
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none p-0"
                    onClick={navigateToSignUp}
                  >
                    {t('SignInPage.SignUp')}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
