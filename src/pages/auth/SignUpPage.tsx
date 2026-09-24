import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './auth.css';
import { getVerifyCodeLcdx, signUpLcdx } from '@/lib/auth/auth';
import { StatusCode } from '@/lib/models';
import { notice } from '@/lib/message';

const QQ_PATTERN = /^\d{5,12}$/;
const CODE_PATTERN = /^\d{4}$/;

interface AuthNavState {
  qqNumber?: string;
}

/**
 * 等价旧版 sign-up.component（LCDX：QQ 号 + 4 位验证码 → 注册或重设密码）。
 * 与上游邮箱注册流的差异（LCDX 有意为之，勿合并回去）：
 * - 无昵称/用户名/邮箱字段、无 OAuth 入口（账号由后端以 QQ 号派生）。
 * - LCDX 已整体删除 EULA（上游 e1f80ea），故注册流不携带 eulaVersion。
 * - 该 QQ 号无账号则注册、已有账号则重设密码，成功后直接签发登录态（lcdx/register_confirm）。
 */
export function SignUpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as AuthNavState | null;

  const [qqNumber, setQqNumber] = useState(() => state?.qqNumber ?? '');
  const [verifyCode, setVerifyCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({
    qqNumber: false,
    verifyCode: false,
    password: false,
    confirmPassword: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 等价旧版 history.replaceState：清掉 nav state，避免刷新重复消费
  useState(() => {
    if (state) window.history.replaceState({}, document.title);
    return null;
  });

  // 等价旧版 disableButtonForInterval(60)：每秒递减，归零后恢复可点
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  const qqNumberValid = QQ_PATTERN.test(qqNumber);
  const verifyCodeValid = CODE_PATTERN.test(verifyCode);
  const passwordValid = password.length >= 8 && password.length <= 100;
  const confirmValid = confirmPassword === password;
  const formValid = qqNumberValid && verifyCodeValid && passwordValid && confirmValid;

  const touch = (field: keyof typeof touched) => setTouched((s) => ({ ...s, [field]: true }));

  async function sendVerifyCode() {
    if (!qqNumberValid) {
      touch('qqNumber');
      return;
    }
    try {
      const resp = await getVerifyCodeLcdx(qqNumber);
      const statusCode: number = resp?.status?.code;
      if (statusCode === StatusCode.OK) {
        notice(t('SignUpPage.Messages.SendCodeSuccess'), 'success');
        setCooldown(60);
      } else if (statusCode === StatusCode.VERIFY_CODE_SEND_TOO_FAST) {
        notice(t('SignUpPage.Messages.SendCodeTooFast'), 'warning');
      } else {
        notice(t('SignUpPage.OperationFailed'));
      }
    } catch {
      notice(t('Common.OperationFailed'));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) {
      setTouched({ qqNumber: true, verifyCode: true, password: true, confirmPassword: true });
      return;
    }
    setSubmitting(true);
    try {
      const resp = await signUpLcdx(qqNumber, verifyCode, password);
      const statusCode: number = resp?.status?.code;
      if (statusCode === StatusCode.OK && resp.data) {
        // 后端以 status.message 区分「注册成功 / 密码重设成功」
        const messageKey = String(resp.status?.message ?? '').toLowerCase().includes('reset')
          ? 'SignUpPage.Messages.ResetSuccess'
          : 'SignUpPage.Messages.RegisterSuccess';
        notice(t(messageKey), 'success');
        // 等价旧版 `if (router.url.startsWith('/sign-up'))`：无卡新用户已被 procLoginResp
        // 送去 /netcode-bind，此处不得覆盖
        if (window.location.pathname.startsWith('/sign-up')) {
          await navigate('/dashboard');
        }
        return;
      }
      if (statusCode === StatusCode.VERIFY_CODE_NOT_CORRECT) {
        notice(t('SignUpPage.Messages.CodeIncorrect'), 'danger');
      } else {
        notice(t('SignUpPage.OperationFailed'));
      }
    } catch {
      notice(t('Common.OperationFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  function navigateToSignIn() {
    void navigate('/sign-in', { state: { qqNumber } });
  }

  return (
    <div className="d-flex justify-content-center px-2">
      <div className="card authorization-card col-12 mb-5">
        <div className="pt-3 pt-lg-4 px-3 px-sm-5 mb-3">
          <div className="mb-4">
            <div className="fs-1 fw-bold">NET</div>
            <div className="fs-5 fw-bold">{t('SignUpPage.Title')}</div>
          </div>

          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="d-grid gap-2 small fw-bold mb-3">
              <div>
                <label htmlFor="qqNumber" className="form-label small">
                  {t('SignUpPage.QQNumber')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  className={'form-control form-control-sm' + (touched.qqNumber && !qqNumberValid ? ' is-invalid' : '')}
                  id="qqNumber"
                  value={qqNumber}
                  onChange={(e) => setQqNumber(e.target.value)}
                  onBlur={() => touch('qqNumber')}
                />
                {touched.qqNumber && !qqNumberValid && (
                  <div className="invalid-feedback">{t('SignUpPage.QQNumberInvalid')}</div>
                )}
                <div className="form-text">{t('SignUpPage.QQMailTip')}</div>
              </div>

              <div>
                <label htmlFor="verifyCode" className="form-label small">
                  {t('SignUpPage.VerificationCode')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    className={'form-control' + (touched.verifyCode && !verifyCodeValid ? ' is-invalid' : '')}
                    id="verifyCode"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    onBlur={() => touch('verifyCode')}
                  />
                  <button className="btn btn-primary" type="button" onClick={() => void sendVerifyCode()} disabled={cooldown > 0}>
                    {cooldown > 0 ? cooldown : t('SignUpPage.Send')}
                  </button>
                  {touched.verifyCode && !verifyCodeValid && (
                    <div className="invalid-feedback">{t('SignUpPage.VerificationCodeErrors.Length')}</div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="password" className="form-label small">
                  {t('SignUpPage.Password')}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={'form-control form-control-sm' + (touched.password && !passwordValid ? ' is-invalid' : '')}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => touch('password')}
                />
                {touched.password && !passwordValid && (
                  <div className="invalid-feedback">{t('SignUpPage.PasswordErrors.Minlength')}</div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="form-label small">
                  {t('SignUpPage.ConfirmPassword')}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className={'form-control form-control-sm' + (touched.confirmPassword && !confirmValid ? ' is-invalid' : '')}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => touch('confirmPassword')}
                />
                {touched.confirmPassword && !confirmValid && (
                  <div className="invalid-feedback">{t('SignUpPage.PasswordErrors.Confirm')}</div>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-sm my-2" disabled={submitting}>
                {t('SignUpPage.Submit')}
              </button>
              <div className="fw-normal d-flex align-items-center justify-content-center gap-1">
                {t('SignUpPage.SignInTip')}
                <button type="button" className="btn btn-link btn-sm text-decoration-none p-0" onClick={navigateToSignIn}>
                  {t('SignUpPage.SignIn')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
