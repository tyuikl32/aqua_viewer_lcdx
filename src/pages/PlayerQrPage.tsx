import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleFill, InfoCircleFill } from 'react-bootstrap-icons';
import { CardQrPanel } from '@/features/cards/CardQrPanel';
import { decodeGuofuCardId } from '@/lib/guofuCard';
import { loadUser, userStore } from '@/lib/user';
import { useStore } from '@/lib/store';

/** 与卡片页 / 后端审计一致的掩码：保留 0/1/4/5/6/7 位 */
const LU_ID_MASK = '11001111000000000000';

function maskLuid(full: string): string {
  let result = '';
  for (let i = 0; i < LU_ID_MASK.length; i++) {
    const slot = LU_ID_MASK.at(i);
    if (slot === '0') result += '*';
    else if (slot === '1') result += full.at(i) ?? '';
    else result += slot as string;
  }
  return result;
}

/**
 * 玩家二维码（左侧导航独立入口）。
 *
 * 只认主卡（`/api/user/me` 的 `cards[].luid`），不认别名；能解出 clientId 的卡才
 * 渲染面板（物理卡/非法卡号不出现）。1 人 1 号，所以通常只有一块。
 */
export function PlayerQrPage() {
  const { t } = useTranslation();
  const user = useStore(userStore);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void loadUser().then(() => setLoaded(true));
  }, []);

  const cards = user?.cards ?? [];
  const eligible = cards.filter((card) => decodeGuofuCardId(card.luid) !== null);

  return (
    <div className="content">
      <h1 className="page-heading">{t('PlayerQrPage.Title')}</h1>

      <div className="hstack alert alert-info" role="alert">
        <InfoCircleFill className="me-2" />
        <div>{t('PlayerQrPage.Intro')}</div>
      </div>

      {loaded && eligible.length === 0 && (
        <div className="hstack alert alert-warning" role="alert">
          <ExclamationTriangleFill className="me-2" />
          <div>{cards.length === 0 ? t('PlayerQrPage.NoCard') : t('PlayerQrPage.UnsupportedCard')}</div>
        </div>
      )}

      {eligible.map((card) => (
        <div className="mb-4" key={card.id}>
          <div className="small text-secondary mb-2">
            {t('PlayerQrPage.CardLabel')}
            {t('Common.Colon')}
            <code className="ms-1">({maskLuid(card.luid)})</code>
          </div>
          <CardQrPanel
            userName={user?.username ?? ''}
            cardId={card.luid}
            fileName={`lcdx-login-qr-${card.id}.png`}
          />
        </div>
      ))}
    </div>
  );
}
