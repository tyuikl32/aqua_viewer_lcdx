import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { dbGetByKey } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { formatNumber } from '@/lib/format';
import { notice } from '@/lib/message';
import { StatusCode } from '@/lib/models';
import { useStore } from '@/lib/store';
import { getCurrentUser, loadUser } from '@/lib/user';
import { maiAssetsHost } from '@/lib/utils';
import { Maimai2SongDetail } from './Maimai2SongDetail';
import type { Maimai2Music, Maimai2RatingEntry, Maimai2RatingItem, Maimai2RatingPool } from './models';
import './Maimai2RatingPage.css';

const rankIcons = ['sp', 'ss', 'ssp', 'sss', 'sssp'] as const;

/** 推分表的列：S+ / SS / SS+ / SSS / SSS+ 的达成率阈值，与 rankIcons 一一对应。 */
const RANKS = [980000, 990000, 995000, 1000000, 1005000] as const;

type PoolKey = 'b35' | 'b15';

function jacketId(input: number): string {
  return input.toString().slice(-4).padStart(6, '0');
}

function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  const fallback = `${maiAssetsHost}assets/mai2/jacket/UI_Jacket_000000.webp`;
  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
}

/** 抄自游戏 DB/RatingTableIDEnum.cs 的 23 行系数表：(达成率阈值, 系数)。 */
const ratingRecords = [
  [0, 0], [100000, 16], [200000, 32], [300000, 48], [400000, 64], [500000, 80],
  [600000, 96], [700000, 112], [750000, 120], [799999, 128], [800000, 136],
  [900000, 152], [940000, 168], [969999, 176], [970000, 200], [980000, 203],
  [989999, 206], [990000, 208], [995000, 211], [999999, 214], [1000000, 216],
  [1004999, 222], [1005000, 224],
] as const;

/**
 * 单曲分公式：floor(ScoreRate × min(达成率, 1005000) × 系数 / 1e8)，与游戏 UserRate.cs 一致。
 *
 * 本函数只服务于推分表的「假想网格」（给定难度与等级会得多少分）；
 * 实际每条成绩的分数一律采信后端 `lcdx/rating` 的 singleRate（那里才含 AP 加成）。
 */
function calcRate(level: number, achievement: number): number {
  const capped = Math.min(achievement, ratingRecords[22][0]);
  let offset = 0;
  for (let index = ratingRecords.length - 1; index >= 0; index -= 1) {
    if (ratingRecords[index][0] <= capped) {
      offset = ratingRecords[index][1];
      break;
    }
  }
  return Math.floor((level * capped * offset) / 100_000_000);
}

/**
 * 推分表下界 = 该池里「最弱的一条有分成绩」，也就是新成绩要挤掉的那一条。
 * 0 分与定数缺失的条目不参与取值 —— 它们不构成需要超越的门槛。
 */
function poolBase(items: Maimai2RatingItem[]): number {
  const positives = items.filter((item) => item.scored && item.rating > 0).map((item) => item.rating);
  return positives.length > 0 ? Math.min(...positives) : 0;
}

/**
 * 生成一张推分表：rows[rankIndex][难度] = 该难度在该等级下的单曲分。
 * 只保留「高于下界」的组合（无上界）；行标取 SSS+ 列难度集合的 20/40/60/80/100 百分位。
 */
function buildTable(items: Maimai2RatingItem[]): { base: number; headers: number[]; rows: Array<Record<number, number>> } {
  const base = poolBase(items);
  const rows = RANKS.map((rank) => {
    const cells: Record<number, number> = {};
    for (let difficulty = 10; difficulty <= 150; difficulty += 1) {
      const value = calcRate(difficulty, rank);
      if (value > base) {
        cells[difficulty] = value;
      }
    }
    return cells;
  });

  const ratingBases = Object.keys(rows[4]).map(Number).sort((left, right) => left - right);
  const headers = [0, 0, 0, 0, 0];
  if (ratingBases.length > 0) {
    const preliminary = [0.2, 0.4, 0.6, 0.8, 1].map((percentile) =>
      ratingBases[Math.ceil(percentile * ratingBases.length) - 1],
    );
    let insertion = 4;
    let last = 0;
    for (let index = 4; index >= 0; index -= 1) {
      if ((preliminary[index] ?? 0) !== last) {
        headers[insertion] = preliminary[index] ?? 0;
        last = preliminary[index] ?? 0;
        insertion -= 1;
      }
    }
  }

  return { base, headers, rows };
}

function difficulty(level: number): { className: string; label: string } | null {
  const values = [
    ['difficulty-basic', 'Basic'],
    ['difficulty-advanced', 'Advanced'],
    ['difficulty-expert', 'Expert'],
    ['difficulty-master', 'Master'],
    ['difficulty-remaster', 'Re:Master'],
  ] as const;
  const value = values[level];
  return value ? { className: value[0], label: value[1] } : null;
}

function RatingRecord({ item, index, onOpen }: {
  item: Maimai2RatingItem;
  index: number;
  onOpen: (music: Maimai2Music | null) => void;
}) {
  const { t } = useTranslation();
  const meta = difficulty(item.level);
  return (
    <div className="col-12 col-md-6 col-xxl-4">
      <div className="card card-btn rating-card" onClick={() => onOpen(item.music ?? null)}>
        <div className="hstack">
          <img
            className="jacket rounded-start"
            src={`${maiAssetsHost}assets/mai2/jacket/UI_Jacket_${jacketId(item.musicId)}.webp`}
            onError={imageFallback}
            alt=""
          />
          {item.musicId !== 0 ? (
            <div className="card-body overflow-hidden py-0 px-2">
              <div className="text-truncate fw-bold m-0"><span>#{index + 1}</span> {item.musicName}</div>
              <div className="text-truncate">{formatNumber(item.score / 10_000, 4, 4)}%</div>
              <div className="text-truncate small rating-score">
                {meta && (
                  <span className={`${meta.className} badge rounded-pill`}>
                    {meta.label} {item.scored ? formatNumber(item.ratingBase / 10, 1, 1) : '?'}
                  </span>
                )}
                <b>➛</b>
                {item.scored
                  ? item.rating
                  : <span className="text-warning" title={t('Maimai2.RatingPage.Unscored')}>—</span>}
              </div>
            </div>
          ) : (
            <div className="card-body overflow-hidden py-0 px-4 text-truncate">No Record</div>
          )}
        </div>
      </div>
    </div>
  );
}

async function loadPools(aimeId: string): Promise<Maimai2RatingPool> {
  const response = await lcdx.get('lcdx/rating', { aimeId });
  if (response?.status?.code !== StatusCode.OK || !response.data) {
    throw new Error(String(response?.status?.message ?? 'lcdx/rating failed'));
  }
  return response.data as Maimai2RatingPool;
}

/** 用本地目录补歌名与曲目对象（卡片与详情抽屉要用）；分池与分数一律用后端结果。 */
async function toItems(entries: Maimai2RatingEntry[]): Promise<Maimai2RatingItem[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const music = await dbGetByKey<Maimai2Music>('maimai2Music', entry.musicId);
      return {
        musicId: entry.musicId,
        level: entry.level,
        romVersion: entry.romVersion,
        score: entry.achievement,
        artistName: music?.artistName ?? 'Unknown Artist',
        ratingBase: entry.scoreRate,
        rating: entry.singleRate,
        comboStatus: entry.comboStatus,
        scored: entry.scored,
        musicName: music?.name ?? `MusicID: ${entry.musicId}`,
        music,
      };
    }),
  );
}

/** Equivalent to the legacy maimai2 best-50 rating component. */
export function Maimai2RatingPage() {
  const { t } = useTranslation();
  const catalogStates = useStore(preloadStates);
  const [best35, setBest35] = useState<Maimai2RatingItem[]>([]);
  const [best15, setBest15] = useState<Maimai2RatingItem[]>([]);
  const [gameMusicRating, setGameMusicRating] = useState(0);
  const [pool, setPool] = useState<PoolKey>('b35');
  const [detailMusic, setDetailMusic] = useState<Maimai2Music | null>(null);
  // 数据没到位之前不算分、不渲染推分表：空池的 base 会是 0，算出来的是一张没有意义的全范围表。
  const [loading, setLoading] = useState(true);
  const catalogReady = catalogStates.maimai2Music === 'OK';
  const catalogFailed = catalogStates.maimai2Music === 'Error';

  useEffect(() => {
    if (!catalogReady) return;
    let active = true;
    void (async () => {
      try {
        await loadUser();
        const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
        // 分池与单曲分（含 AP 加成）都在后端算；这里只补歌名与曲目对象。
        const pools = await loadPools(aimeId);
        const [oldItems, newItems] = await Promise.all([toItems(pools.b35), toItems(pools.b15)]);
        if (!active) return;
        setBest35(oldItems);
        setBest15(newItems);
        setGameMusicRating(pools.gameMusicRating);
        if (oldItems.length === 0 && newItems.length === 0) {
          notice(t('Maimai2.RatingPage.Empty'));
        }
      } catch (error) {
        if (active) notice(t('Common.OperationFailed'));
      } finally {
        // 不论成败都要落地：否则目录预载成功但后端报错时，页面会永远停在加载态。
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [catalogReady]);

  const computedB35 = best35.reduce((sum, item) => sum + item.rating, 0);
  const computedB15 = best15.reduce((sum, item) => sum + item.rating, 0);
  const unscored = [...best35, ...best15].filter((item) => !item.scored).length;
  // 游戏自己算的总分与本地复算之差 = 谱面定数缺失吃掉的分数。
  const unscoredGap = Math.max(0, gameMusicRating - (computedB35 + computedB15));

  const activePool = pool === 'b35' ? best35 : best15;
  const table = useMemo(() => buildTable(activePool), [activePool]);

  const recommendationValue = (ratingBase: number, rank: number) =>
    table.rows[rank]?.[ratingBase] === undefined ? ' ' : String(table.rows[rank][ratingBase]);

  return (
    <div className="maimai2-rating-page">
      <h1 className="page-heading">{t('Maimai2.RatingPage.Title')}</h1>

      <div className="card p-1 mt-3">
        <div className="row justify-content-between p-3 align-items-center" style={{ fontSize: '1.25rem' }}>
          <span className="col-auto">Rating:</span>
          <span className="col-auto">
            {loading ? (
              <span className="text-body-secondary">—</span>
            ) : (
              <>
                <span className="player-rating" style={{ fontSize: '0.75rem' }}>{computedB35}+{computedB15}=</span>
                {gameMusicRating}
              </>
            )}
          </span>
        </div>
        {unscored > 0 && (
          <div className="px-3 pb-2 small text-warning">
            {t('Maimai2.RatingPage.UnscoredNotice', { count: unscored, gap: unscoredGap })}
          </div>
        )}
      </div>

      <div className="card mt-3 mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="card-title" style={{ fontSize: '1.25rem' }}>
              {t(pool === 'b35' ? 'Maimai2.RatingPage.ElevateRecommendB35' : 'Maimai2.RatingPage.ElevateRecommendB15')}
            </span>
            <div className="btn-group btn-group-sm ms-auto" role="group" aria-label={t('Maimai2.RatingPage.ElevateRecommend')}>
              {(['b35', 'b15'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`btn ${pool === key ? 'btn-secondary' : 'btn-outline-secondary'}`}
                  onClick={() => setPool(key)}
                >
                  {t(key === 'b35' ? 'Maimai2.RatingPage.B35' : 'Maimai2.RatingPage.B15').trim()}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : catalogFailed ? (
            <div className="text-body-secondary py-3">{t('Common.FailedToLoad')}</div>
          ) : activePool.length === 0 ? (
            <div className="text-body-secondary py-3">{t('Maimai2.RatingPage.Empty')}</div>
          ) : (
            <>
              <div className="table-container d-block d-md-none">
                <table className="table table-striped" style={{ textAlign: 'center' }}>
                  <thead>
                    <tr>
                      <th />
                      {table.headers.map((header, index) => (
                        <th style={{ fontWeight: 'bold' }} key={index}>{header !== 0 ? header / 10 : ' '}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rankIcons.map((icon, rowIndex) => (
                      <tr key={icon}>
                        <td><img className="rank-icon" src={`${maiAssetsHost}assets/mai2/common/music_icon_${icon}.webp`} alt="" /></td>
                        {table.headers.map((header, index) => (
                          <td key={index}>{recommendationValue(header, rowIndex)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="table-container d-none d-md-block">
                <table className="table table-striped" style={{ textAlign: 'center' }}>
                  <thead>
                    <tr>
                      <th />
                      {rankIcons.map((icon) => (
                        <th key={icon}><img className="rank-icon" src={`${maiAssetsHost}assets/mai2/common/music_icon_${icon}.webp`} alt="" /></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.headers.map((header, rowIndex) => (
                      <tr key={rowIndex}>
                        <td style={{ fontWeight: 'bold' }}>{header !== 0 ? header / 10 : ' '}</td>
                        {rankIcons.map((_, rankIndex) => <td key={rankIndex}>{recommendationValue(header, rankIndex)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {!loading && (
        <>
          <div className="mb-3 d-flex align-items-center mt-3">
            <h2 className="mb-0">{t('Maimai2.RatingPage.B35')}</h2>
            <span className="badge bg-secondary text-bg-secondary rounded-pill ms-2">{computedB35}</span>
          </div>
          <div className="row mb-4 g-2">
            {best35.map((item, index) => (
              <RatingRecord item={item} index={index} onOpen={setDetailMusic} key={`${item.musicId}-${item.level}-${index}`} />
            ))}
          </div>

          <div className="mb-3 d-flex align-items-center mt-3">
            <h2 className="mb-0">{t('Maimai2.RatingPage.B15')}</h2>
            <span className="badge bg-info text-bg-info rounded-pill ms-2">{computedB15}</span>
          </div>
          <div className="row mb-4 g-2">
            {best15.map((item, index) => (
              <RatingRecord item={item} index={index} onOpen={setDetailMusic} key={`${item.musicId}-${item.level}-${index}`} />
            ))}
          </div>
        </>
      )}

      <Maimai2SongDetail music={detailMusic} open={detailMusic !== null} onClose={() => setDetailMusic(null)} />
    </div>
  );
}
