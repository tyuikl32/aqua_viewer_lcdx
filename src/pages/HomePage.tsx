import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { accountStore } from '@/lib/auth/account';
import { useStore } from '@/lib/store';

/**
 * 等价旧版 home.component（LCDX：laochan 品牌首屏 + maimai DX 服务说明 + ICP 备案页脚）。
 * 上游的多游戏支持列表与 turtle 彩蛋（aqua.naominet.live DNS、ongeki/chuni 支持声明）在本部署
 * 已不成立，LCDX 自家版本已整体替换为当前内容，故按 LCDX 意图重放；上游 i18n 键保留未删。
 */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const account = useStore(accountStore);

  // 等价旧版 ngOnInit：已登录直接进仪表板
  useEffect(() => {
    if (account) void navigate('/dashboard');
  }, [account, navigate]);

  return (
    <div className="container-xxl px-3 py-4 py-md-5">
      <div className="row align-items-center justify-content-center g-4 py-md-4">
        <div className="col-12 col-md-auto text-center">
          <img src="/assets/laochan.svg" width="144" height="144" alt="NET" className="img-fluid" />
        </div>
        <div className="col-12 col-md-7 col-lg-6 text-center text-md-start">
          <h1 className="display-3 fw-semibold mb-2">NET</h1>
          <p className="lead text-body-secondary mb-4">{t('HomePage.LcdxDescription')}</p>
          <button className="btn btn-primary px-4" onClick={() => navigate('/sign-in')}>
            {t('HomePage.SignIn')}
          </button>
        </div>
      </div>

      <hr className="my-4 my-md-5" />

      <div className="row justify-content-center">
        <div className="col-12 col-lg-9">
          <h2 className="h4 fw-semibold mb-3">{t('HomePage.MaimaiService')}</h2>
          <p className="text-body-secondary mb-0">{t('HomePage.MaimaiServiceDescription')}</p>
        </div>
      </div>

      <footer className="pt-5 text-center">
        <a className="text-body-secondary small" href="https://beian.miit.gov.cn/" target="_blank" rel="noopener">
          粤ICP备2026126841号-1
        </a>
      </footer>
    </div>
  );
}
