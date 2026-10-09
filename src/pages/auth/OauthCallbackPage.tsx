import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loginWithOAuth } from '@/lib/auth/auth';
import { getAccount } from '@/lib/auth/account';
import { StatusCode } from '@/lib/models';
import { notice } from '@/lib/message';

/** 等价旧版 oauth-callback.component（不可见处理页：state 校验 + 换 token + 分流） */
export function OauthCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { type } = useParams<{ type: string }>();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const storedState = localStorage.getItem('oauth_state');

    if (state && state !== storedState) {
      notice(t('OAuthPage.InvalidState'));
      if (getAccount()) {
        void navigate('/profile');
      } else {
        void navigate('/login');
      }
      return;
    }

    if (code && type && state) {
      void loginWithOAuth(code, type)
        .then((resp) => {
          if (resp?.status) {
            const statusCode: number = resp.status.code;
            if (statusCode === StatusCode.OK && resp.data) {
              localStorage.removeItem('oauth_state');
              notice(t('OAuthPage.OperationFailed'));
              void navigate('/');
            } else if (statusCode === StatusCode.OAUTH_USER_NOT_REGISTERED) {
              if (!getAccount()) {
                notice(t('OAuthPage.OperationFailed'));
                const token = resp.data.token;
                const name = resp.data.name;
                const username = resp.data.userName;
                const email = resp.data.email;
                void navigate('/sign-up', { state: { token, type, name, username, email } });
              } else {
                const token = resp.data.token;
                const email = resp.data.email;
                void navigate('/profile', { state: { token, type, email } });
              }
            } else if (statusCode === StatusCode.OAUTH_ALREADY_REGISTERED) {
              void navigate('/profile');
            } else {
              localStorage.removeItem('oauth_state');
              notice(t('OAuthPage.OperationFailed'));
              void navigate('/');
            }
          }
        })
        .catch(() => {
          localStorage.removeItem('oauth_state');
          notice(t('OAuthPage.OperationFailed'));
          void navigate('/');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
