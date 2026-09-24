import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './BannedPage.css';
import { restoreAccess } from '@/lib/auth/access';
import { logout } from '@/lib/auth/auth';

/** 等价旧版 banned.component */
export function BannedPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const appealGroup = '295954906';

  useEffect(() => {
    void restoreAccess().then((status) => {
      if (!status?.banned) {
        void navigate('/dashboard');
      }
    });
  }, [navigate]);

  async function copy() {
    await navigator.clipboard.writeText(appealGroup);
    setCopied(true);
  }

  function doLogout() {
    void logout().then(() => location.assign(''));
  }

  return (
    <main className="ban-page d-flex align-items-center justify-content-center text-center p-4">
      <div>
        <div className="ban-title">YOU ARE BANNED</div>
        <div className="ban-title chinese">{t('BannedPage.Title')}</div>
        <p className="lead mt-4">{t('BannedPage.Lead')}</p>
        <p>{t('BannedPage.AppealHint')}</p>
        <button className="btn btn-lg btn-outline-light appeal" onClick={() => void copy()}>
          {appealGroup} · {copied ? t('BannedPage.Copied') : t('BannedPage.CopyGroup')}
        </button>
        <div className="mt-4">
          <button className="btn btn-light" onClick={doLogout}>
            {t('BannedPage.Logout')}
          </button>
        </div>
      </div>
    </main>
  );
}
