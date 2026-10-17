import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { getCurrentUser } from '@/lib/user';
import { isOk } from '@/lib/models';
import { notice } from '@/lib/message';
import type { CabinetDxnumItem, CabinetDxnumResult, PlayerWindow } from './cabinet-models';
import { Maimai2Pagination } from './Maimai2Pagination';

const DEFAULT_PAGE_SIZE = 20;

/** 三窗（半小时/一小时/两小时）。today 不作为展示行（额外一窗会与 netUpsert 文案不一致） */
type WindowKey = 'halfHour' | 'oneHour' | 'twoHour';

interface WindowValue {
  key: WindowKey;
  labelKey: string;
  players: number;
  plays: number;
}

const WINDOW_SPECS: { key: WindowKey; labelKey: string }[] = [
  { key: 'halfHour', labelKey: 'Maimai2.DxnumPage.HalfHour' },
  { key: 'oneHour', labelKey: 'Maimai2.DxnumPage.OneHour' },
  { key: 'twoHour', labelKey: 'Maimai2.DxnumPage.TwoHour' },
];

/**
 * 机台人数查询（dxnum v4）：把 QQBot `dx几人` Web 化。
 *
 * - 准入：**已绑定卡片**（`getCurrentUser().cards.length > 0`），不再依赖权限组；菜单/守卫同口径。
 * - 查询驱动：进入空态不请求；输入机台别名前缀 + 查询（或回车）；刷新重发当前关键词；新结果覆盖旧结果。
 * - 结果卡对齐 netUpsert：命中 1 台给完整明细（含在玩名单与 2 小时名单）；命中多台只给「当页」数字，
 *   **页面不出现任何玩家名字**（后端 namesHidden 已不下发）。
 */
export function Maimai2DxnumPage() {
  const { t } = useTranslation();

  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [result, setResult] = useState<CabinetDxnumResult | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  /** 是否已发起过一次带关键词的查询（决定空态 vs 未命中 vs 失败） */
  const [searched, setSearched] = useState(false);

  const generationRef = useRef(0);

  const userName = () => getCurrentUser()?.username ?? '';

  /** 未绑卡兜底：守卫已挡，但用户态变化后不再渲染查询区（与 RequireDxnumAccess 同条件） */
  const hasBoundCard = (getCurrentUser()?.cards?.length ?? 0) > 0;

  const load = useCallback(
    async (kw: string, p: number, generation: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('keyword', kw);
      params.set('page', String(p));
      params.set('pageSize', String(pageSize));
      const resp = await lcdx.get(`lcdx/cabinet/dxnum/${encodeURIComponent(userName())}?${params}`);
      if (generation !== generationRef.current) return;
      if (isOk(resp)) {
        setResult(resp.data as CabinetDxnumResult);
        setError(false);
      } else {
        notice(t('Maimai2.DxnumPage.LoadFailed'));
        // 失败降级：清空结果并标记错误（不渲染成「未找到匹配机台」，避免把故障误判为空结果）
        setResult(null);
        setError(true);
      }
      setSearched(true);
      setLoading(false);
    },
    [pageSize, t],
  );

  // 查询驱动：仅在已提交关键词（query 非空）时请求；空关键词不发请求、不列任何机台
  useEffect(() => {
    if (!hasBoundCard || query === '') return;
    const generation = ++generationRef.current;
    void load(query, page, generation);
  }, [hasBoundCard, query, page, load]);

  const submit = () => {
    const next = keyword.trim();
    if (next === '') return;
    if (next === query) {
      // 关键词未变：useEffect 不会重跑，直接重发（等价点一次刷新）
      void load(next, page, ++generationRef.current);
      return;
    }
    setPage(1);
    setQuery(next);
  };

  const refresh = () => {
    if (query === '') return;
    void load(query, page, ++generationRef.current);
  };

  const changePage = (next: number) => {
    if (next !== page) setPage(next);
  };

  if (!hasBoundCard) {
    return <div className="alert alert-warning">{t('Maimai2.DxnumPage.NoBindCard')}</div>;
  }

  const items = result?.items ?? [];
  const hasItems = Boolean(result) && items.length > 0;
  const single = hasItems && result!.matchedCount === 1 ? items[0] : null;
  const multi = hasItems && !single;

  return (
    <div className="page-heading">
      <h2 className="card-title">{t('Maimai2.DxnumPage.Title')}</h2>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <input
          className="form-control"
          style={{ maxWidth: '18rem' }}
          placeholder={t('Maimai2.DxnumPage.Placeholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          maxLength={32}
          aria-label={t('Maimai2.DxnumPage.Placeholder')}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={keyword.trim() === '' || loading}
        >
          {t('Maimai2.DxnumPage.Search')}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={refresh}
          disabled={query === '' || loading}
        >
          {t('Maimai2.DxnumPage.Refresh')}
        </button>
      </div>

      {loading && <div className="text-muted mb-2">{t('Maimai2.Cabinets.Loading')}</div>}

      {!loading && error && <div className="alert alert-warning">{t('Maimai2.DxnumPage.LoadFailed')}</div>}

      {!loading && !error && !searched && (
        <div className="alert alert-info">{t('Maimai2.DxnumPage.Hint')}</div>
      )}

      {!loading && !error && searched && result !== null && result.matchedCount === 0 && (
        <div className="alert alert-info">{t('Maimai2.DxnumPage.NoMatch')}</div>
      )}

      {!loading && single && <SingleCabinetCard item={single} />}

      {!loading && multi && result !== null && (
        <MultiCabinetCard items={items} matchedCount={result.matchedCount} />
      )}

      {!loading && multi && result !== null && result.matchedCount > result.pageSize && (
        <Maimai2Pagination
          current={page}
          pageSize={result.pageSize}
          totalItems={result.matchedCount}
          onPageChange={changePage}
        />
      )}
    </div>
  );
}

/** 单台命中：标题 + LC + 三窗数字 + 在玩名单 + 2 小时名单（对齐 netUpsert 单台分支） */
function SingleCabinetCard({ item }: { item: CabinetDxnumItem }) {
  const { t } = useTranslation();
  const location = item.locationName ?? item.nickName ?? '—';
  const playing = item.playing ?? [];
  const recent = item.recentPlayers ?? [];
  const quiet = WINDOW_SPECS.every(({ key }) => item[key].players === 0 && item[key].plays === 0);

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title mb-3">
          {t('Maimai2.DxnumPage.SingleTitle', { location })}{' '}
          <span className={`badge ${item.isSpecialMode > 0 ? 'text-bg-warning' : 'text-bg-secondary'}`}>LC</span>
        </h5>
        <div className="mb-2">
          {t('Maimai2.DxnumPage.LcMode', {
            value: t(item.isSpecialMode > 0 ? 'Maimai2.DxnumPage.Yes' : 'Maimai2.DxnumPage.No'),
          })}
        </div>

        <WindowTable values={WINDOW_SPECS.map((spec) => ({ ...spec, ...item[spec.key] }))} />

        <div className="mt-3 fw-semibold">{t('Maimai2.DxnumPage.PlayingTitle')}</div>
        {playing.length > 0 ? (
          <ul className="list-unstyled mb-0">
            {playing.map((player) => (
              <li key={player.userId}>{player.userName}</li>
            ))}
          </ul>
        ) : (
          <div className="text-muted">—</div>
        )}

        <div className="mt-3 fw-semibold">{t('Maimai2.DxnumPage.RecentTitle')}</div>
        {recent.length > 0 ? (
          <ul className="list-unstyled mb-0">
            {recent.map((player) => (
              <li key={player.userId}>
                {player.userName}
                {t('Maimai2.DxnumPage.PlaysSuffix', { count: player.plays })}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted">—</div>
        )}

        {quiet && <div className="text-muted mt-3">{t('Maimai2.DxnumPage.Nobody')}</div>}
      </div>
    </div>
  );
}

/** 多台命中：标题 + 当页合计三行 + 每台一行数字；**不渲染任何玩家名字** */
function MultiCabinetCard({ items, matchedCount }: { items: CabinetDxnumItem[]; matchedCount: number }) {
  const { t } = useTranslation();
  const totals = sumWindows(items);
  const location = items[0].locationName ?? items[0].nickName ?? '—';

  return (
    <div className="card">
      <div className="card-body">
        <h5 className="card-title mb-3">
          {t('Maimai2.DxnumPage.MultiTitle', { location, count: matchedCount })}
        </h5>

        <WindowTable values={totals} pageOnlyLabel={t('Maimai2.DxnumPage.PageOnly')} />

        <div className="table-responsive mt-3">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>{t('Maimai2.DxnumPage.ColCabinet')}</th>
                <th>{t('Maimai2.DxnumPage.ColLocation')}</th>
                <th>{t('Maimai2.DxnumPage.ColLcMode')}</th>
                <th className="text-center">{t('Maimai2.DxnumPage.HalfHourShort')}</th>
                <th className="text-center">{t('Maimai2.DxnumPage.OneHourShort')}</th>
                <th className="text-center">{t('Maimai2.DxnumPage.TwoHourShort')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.nickName ?? ''}-${index}`}>
                  <td>{item.nickName ?? '—'}</td>
                  <td>{item.locationName ?? '—'}</td>
                  <td>
                    {item.isSpecialMode > 0 ? (
                      <span className="badge text-bg-warning">LC</span>
                    ) : (
                      <span className="badge text-bg-secondary">—</span>
                    )}
                  </td>
                  <td className="text-center fw-bold">{item.halfHour.players}</td>
                  <td className="text-center fw-bold">{item.oneHour.players}</td>
                  <td className="text-center fw-bold">{item.twoHour.players}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totals[0].plays === 0 && <div className="text-muted mt-2">{t('Maimai2.DxnumPage.FewPeople')}</div>}
      </div>
    </div>
  );
}

/** 多台当页合计（渲染层求和；文案以「当页」标注） */
function sumWindows(items: CabinetDxnumItem[]): WindowValue[] {
  const sum = (key: WindowKey): PlayerWindow =>
    items.reduce<PlayerWindow>(
      (acc, item) => ({
        players: acc.players + (item[key]?.players ?? 0),
        plays: acc.plays + (item[key]?.plays ?? 0),
      }),
      { players: 0, plays: 0 },
    );
  return WINDOW_SPECS.map((spec) => ({ ...spec, ...sum(spec.key) }));
}

/** 三行人数表（netUpsert：「半小时内游玩人数：X（共Y次）」；多台时数字为当页合计并标注） */
function WindowTable({ values, pageOnlyLabel }: { values: WindowValue[]; pageOnlyLabel?: string }) {
  const { t } = useTranslation();
  return (
    <table className="table table-sm mb-0">
      <tbody>
        {values.map((row) => (
          <tr key={row.key}>
            <th scope="row" className="border-0 ps-0 fw-normal text-muted">
              {t(row.labelKey, { players: row.players, plays: row.plays })}
              {pageOnlyLabel && <span className="ms-1">{pageOnlyLabel}</span>}
            </th>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
