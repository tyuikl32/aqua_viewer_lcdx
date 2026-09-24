import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loginLcdxOnetime, logout } from '@/lib/auth/auth';
import { notice } from '@/lib/message';
import { StatusCode } from '@/lib/models';

/**
 * 等价旧版 onetime-sign-in：先登出再以一次性 token 走 LCDX 登录（lcdx/onetime-v2）。
 * 成功 → 提示并回 dashboard；LOGIN_FAILED → 红色提示回首页；其他/网络错误 → 兜底提示回首页。
 */
export function OnetimeSignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token') ?? '';
    void (async () => {
      // 等价旧版：无条件先登出，再一次性登录
      await logout();
      try {
        const resp = await loginLcdxOnetime(token);
        const statusCode: number = resp?.status?.code;
        if (statusCode === StatusCode.OK && resp.data) {
          notice(t('SignInPage.LoginSuccessMessage'));
          if (window.location.pathname.startsWith('/onetime-sign-in')) {
            navigate('/dashboard');
          }
        } else if (statusCode === StatusCode.LOGIN_FAILED) {
          notice(t('SignInPage.LoginFailedMessage'), 'danger');
          navigate('/');
        } else {
          notice(t('OnetimeSignInPage.OperationFailed'));
          navigate('/');
        }
      } catch {
        notice(t('Common.OperationFailed'));
        navigate('/');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 等价旧版：仅按进入页面执行一次
  }, []);

  // 等价旧版模板（占位加载文案）
  return <p>Please Wait...</p>;
}
