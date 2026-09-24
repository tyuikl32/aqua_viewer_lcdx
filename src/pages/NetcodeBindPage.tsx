import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ExclamationTriangleFill } from 'react-bootstrap-icons';
import { lcdx } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { isOk } from '@/lib/models';
import { getCurrentUser, loadUser } from '@/lib/user';

/**
 * 等价旧版 netcode-bind：无卡用户输入 NET 码绑定（lcdx/bind），已有卡自动回 dashboard。
 * 修正：旧版成功路径也会先弹一次 OperationFailed（无条件 notice 再跳转），此处仅在失败时提示。
 */
export function NetcodeBindPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [netCode, setNetCode] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await loadUser();
        const user = getCurrentUser();
        if (user && user.cards.length > 0) {
          navigate('/dashboard');
        }
      } catch {
        /* 等价旧版：加载失败不阻塞输入 */
      }
      setLoaded(true);
    })();
  }, [navigate]);

  /** 等价旧版 Validators.pattern(/^\d+$/) */
  const valid = /^\d+$/.test(netCode);

  const onClick = async () => {
    if (!valid) {
      return;
    }
    setLoaded(false);
    try {
      const resp = await lcdx.get(
        `lcdx/bind/${encodeURIComponent(getCurrentUser()?.username ?? '')}/${encodeURIComponent(netCode)}`,
      );
      setLoaded(true);
      if (isOk(resp)) {
        navigate('/dashboard');
      } else {
        notice(t('NetCodeBindPage.OperationFailed'));
      }
    } catch {
      notice(t('Common.OperationFailed'));
      setLoaded(true);
    }
  };

  return (
    <>
      <h1 className="page-heading">{t('NetCodeBindPage.Title')}</h1>

      <div className="hstack alert alert-warning" role="alert">
        <ExclamationTriangleFill className="me-2" />
        <div>{t('NetCodeBindPage.Description')}</div>
      </div>

      <div className="card mt-3">
        <div className="card-body">
          <h5 className="card-title">{t('NetCodeBindPage.InputTitle')}</h5>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void onClick();
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={20}
              className="form-control mb-3"
              id="netCode"
              value={netCode}
              onChange={(event) => setNetCode(event.target.value)}
            />
            <button type="submit" className="btn btn-primary w-100" disabled={!loaded || !valid}>
              {!loaded && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>}
              {t('NetCodeBindPage.Bind')}
            </button>
          </form>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body">
          <ol>
            <li>{t('NetCodeBindPage.Instruction1')}</li>
            <li>{t('NetCodeBindPage.Instruction2')}</li>
            <li>{t('NetCodeBindPage.Instruction3')}</li>
          </ol>
        </div>
      </div>

      <div className="text-center mt-3">
        <Link className="btn btn-link" to="/dashboard">
          {t('NetCodeBindPage.ContinueWithoutBinding')}
        </Link>
      </div>
    </>
  );
}
