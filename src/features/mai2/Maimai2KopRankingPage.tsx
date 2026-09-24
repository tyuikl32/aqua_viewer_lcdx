import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import './Maimai2KopRankingPage.css';

/** 等价旧版 KOPRankings（sega/maimai2/model/Maimai2Profile.ts） */
export interface KOPRankings {
  userId: number;
  currentUserName: string;
  score: number;
  tournamentId: number;
  rankDate: Date;
}

const MEDALS = ['gold', 'silver', 'bronze'];

/** 等价旧版 `| date: 'yyyy/MM/dd HH:mm:ss'` */
function formatRankDate(value: Date | string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/**
 * 等价旧版 maimai2-kop-ranking（LCDX）：GET lcdx/kop/rank（裸数组响应）+ 前三名奖牌 + 分数百分比。
 * 修正：旧版标题/表头/空态为硬编码文案，此处按项目规范走 i18n。
 */
export function Maimai2KopRankingPage() {
  const { t } = useTranslation();
  const [rankings, setRankings] = useState<KOPRankings[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        // 该端点为裸数组响应（旧版直接赋值给列表），此处兼容信封与非信封两种形态
        const resp = await lcdx.get('lcdx/kop/rank');
        const list = Array.isArray(resp) ? resp : (resp?.data ?? []);
        setRankings(Array.isArray(list) ? (list as KOPRankings[]) : []);
      } catch {
        setRankings([]);
      }
    })();
  }, []);

  return (
    <div className="kop-ranking-page">
      <h1 className="page-heading">KOP 6th</h1>
      {rankings.length === 0 ? (
        <div className="card p-1" style={{ maxWidth: '100%' }}>
          {t('Maimai2.KopPage.NoRanking')}
        </div>
      ) : (
        <>
          <p className="mt-3"></p>
          <div className="ranking">
            <table className="mt-1">
              <thead>
                <tr>
                  <th>{t('Maimai2.KopPage.Rank')}</th>
                  <th>{t('Maimai2.KopPage.Name')}</th>
                  <th>{t('Maimai2.KopPage.Score')}</th>
                  <th>{t('Maimai2.KopPage.Date')}</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((item, index) => (
                  <tr key={`${item.userId}-${index}`}>
                    <td className="rank position-relative">
                      {index < 3 ? (
                        <img className="medal" src={`/assets/${MEDALS[index]}-medal.svg`} alt="" />
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </td>
                    <td className="name">
                      <span style={index < 3 ? { fontWeight: 'bold' } : undefined}>
                        {item.currentUserName}
                      </span>
                    </td>
                    <td className="pc">{(item.score / 10000).toFixed(4)}%</td>
                    <td className="pc">{formatRankDate(item.rankDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
