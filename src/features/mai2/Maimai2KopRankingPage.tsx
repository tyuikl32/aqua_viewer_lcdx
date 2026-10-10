import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import './Maimai2KopRankingPage.css';

/** 届次元数据（GET lcdx/kop/current 与 lcdx/kop/tournaments 同形）。 */
export interface KopTournament {
  tournamentId: number;
  kopNo: number;
  shortName: string;
  name: string;
  musicIds: number[];
  requiredLevel: number;
  openTime: string;
  closeTime: string;
  isEnabled: boolean;
  isOpen: boolean;
}

/** 榜单条目（GET lcdx/kop/rank）。 */
export interface KopRankItem {
  rank: number;
  userId: number;
  currentUserName: string;
  score: number;
  deluxScore: number;
  tournamentId: number;
  kopNo: number | null;
  rankDate: string;
}

const MEDALS = ['gold', 'silver', 'bronze'];

/** 后端对 KOP 端点返回裸数组/对象；此处兼容信封形态。 */
function unwrap<T>(resp: unknown): T | null {
  if (resp === null || resp === undefined) {
    return null;
  }
  if (Array.isArray(resp)) {
    return resp as T;
  }
  const data = (resp as { data?: unknown }).data;
  return (data ?? null) as T | null;
}

/** 等价旧版 `| date: 'yyyy/MM/dd HH:mm:ss'` */
function formatRankDate(value: string | null | undefined): string {
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

/** 期间展示用（到分钟即可）。 */
function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

/**
 * KOP 预选榜（LCDX）。
 *
 * 与旧版（maimai2-kop-ranking）的差异：
 * - 标题/期间改为读取 `lcdx/kop/current`，不再硬编码 "KOP 6th"；
 * - 新增届次切换（`lcdx/kop/tournaments` + `rank?tournamentId=`）；
 * - 不做"我的成绩"（原版也没有）。
 */
export function Maimai2KopRankingPage() {
  const { t } = useTranslation();
  const [tournaments, setTournaments] = useState<KopTournament[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rankings, setRankings] = useState<KopRankItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 届次列表 + 当前启用届次（缺省选中）
  useEffect(() => {
    void (async () => {
      let list: KopTournament[] = [];
      let current: KopTournament | null = null;
      try {
        list = unwrap<KopTournament[]>(await lcdx.get('lcdx/kop/tournaments')) ?? [];
      } catch {
        list = [];
      }
      try {
        current = unwrap<KopTournament>(await lcdx.get('lcdx/kop/current'));
      } catch {
        current = null;
      }
      setTournaments(list);
      setSelectedId(current?.tournamentId ?? list[0]?.tournamentId ?? null);
      setLoaded(true);
    })();
  }, []);

  // 榜单
  useEffect(() => {
    if (selectedId === null) {
      setRankings([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const resp = await lcdx.get('lcdx/kop/rank', { tournamentId: selectedId });
        const list = unwrap<KopRankItem[]>(resp) ?? [];
        if (!cancelled) {
          setRankings(list);
        }
      } catch {
        if (!cancelled) {
          setRankings([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = tournaments.find((item) => item.tournamentId === selectedId) ?? null;
  const heading = selected?.shortName || t('Maimai2.KopPage.Title');

  let statusKey = '';
  if (selected) {
    const open = Date.parse(selected.openTime);
    const close = Date.parse(selected.closeTime);
    if (!Number.isNaN(open) && !Number.isNaN(close)) {
      const now = Date.now();
      statusKey =
        now < open
          ? 'Maimai2.KopPage.StatusUpcoming'
          : now > close
            ? 'Maimai2.KopPage.StatusClosed'
            : 'Maimai2.KopPage.StatusOpen';
    }
  }

  return (
    <div className="kop-ranking-page">
      <h1 className="page-heading">{heading}</h1>

      {selected && (
        <div className="row align-items-center mb-2">
          <div className="col-12 col-md-auto">
            <span className={`badge ${statusKey === 'Maimai2.KopPage.StatusOpen' ? 'text-bg-success' : 'text-bg-secondary'}`}>
              {statusKey ? t(statusKey) : ''}
            </span>
            <span className="ms-2">{selected.name}</span>
          </div>
          <div className="col-12 col-md-auto mt-2 mt-md-0">
            <span className="text-body-secondary">
              {t('Maimai2.KopPage.Period')}: {formatDateTime(selected.openTime)} ~ {formatDateTime(selected.closeTime)}
            </span>
          </div>
        </div>
      )}

      {tournaments.length > 1 && (
        <div className="row mb-3 align-items-center">
          <label className="col-auto col-form-label" htmlFor="kop-tournament-select">
            {t('Maimai2.KopPage.Edition')}
          </label>
          <div className="col-md-4">
            <select
              id="kop-tournament-select"
              className="form-select"
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(Number(event.target.value))}
            >
              {tournaments.map((item) => (
                <option key={item.tournamentId} value={item.tournamentId}>
                  {item.shortName}
                  {item.isEnabled ? ` (${t('Maimai2.KopPage.StatusOpen')})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {rankings.length === 0 ? (
        <div className="card p-1" style={{ maxWidth: '100%' }}>
          {loaded && tournaments.length === 0
            ? t('Maimai2.KopPage.NoTournament')
            : t('Maimai2.KopPage.NoRanking')}
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
                        <span>{item.rank || index + 1}</span>
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
