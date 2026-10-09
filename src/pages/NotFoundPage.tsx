import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import './NotFoundPage.css';

/** 等价旧版 not-found.component（LCDX 版：404 终端日志卡片） */
export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasReferrer = Boolean(document.referrer);

  return (
    <div className="nf-container">
      <div className="card shadow nf-card">
        <div className="card-body text-center p-4 p-md-5">
          <div className="nf-eyebrow">{t('NotFound.Eyebrow')}</div>
          <div className="nf-404-wrap">
            <span className="display-3 fw-semibold lh-1">404</span>
          </div>
          <div className="mb-3">
            <span className="badge text-bg-warning text-body">M&nbsp;I&nbsp;S&nbsp;S</span>
          </div>

          <div className="nf-log mb-3">
            <div>
              &gt; connecting lcdxnet.am-allnet.com ... <span className="ok">OK</span>
            </div>
            <div>&gt; resolve /this-page ...</div>
            <div>
              &gt; status: <span className="err">404 NOT FOUND</span> <span className="cur" />
            </div>
          </div>

          <p className="mb-1 nf-desc">
            {t('NotFound.Line1')}
            <br />
            {t('NotFound.Line2')}
          </p>
          <div className="text-body-secondary nf-sub">{t('NotFound.EnglishLine')}</div>

          <div className="d-flex gap-2 justify-content-center flex-wrap mt-4">
            <a className="btn btn-success px-4" href="https://lcdxnet.am-allnet.com">
              {t('NotFound.Home')}
            </a>
            {hasReferrer && (
              <button
                type="button"
                className="btn btn-outline-secondary px-4"
                onClick={() => navigate(-1)}
              >
                {t('NotFound.Back')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
