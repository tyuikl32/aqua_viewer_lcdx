import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { getCurrentUser } from '@/lib/user';
import { isOk } from '@/lib/models';
import { notice } from '@/lib/message';
import { useBotPermission, MANAGE_PERMISSIONS } from '@/lib/botPermission';
import type { CabinetDxnumResult } from './cabinet-models';
import { formatClock } from './cabinet-models';
import { Maimai2Pagination } from './Maimai2Pagination';

const DEFAULT_PAGE_SIZE = 20;

/**
 * 机台人数查询（dxnum v3）：把 QQBot dx几人 Web 化。
 * 按机台别名前缀查；多台表格 + 分页 + 行展开在玩名单。
 * 鉴权：hasManage ∨ P≥7（守卫）；后端 P≥7 全量 / 1≤P<7 授权 / P<1 拒。
 */
export function Maimai2DxnumPage() {
  const { t } = useTranslation();
  const permission = useBotPermission();

  const [keyword, setKeyword] = useState('');
  const [committed, setCommitted] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [result, setResult] = useState<CabinetDxnumResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const generationRef = useRef(0);

  const userName = () => getCurrentUser()?.username ?? '';

  /** 越权兜底：守卫已挡，但权限态 loaded 前不渲染查询区（与 RequireDxnumAccess 同条件） */
  const allowed = permission.loaded && (permission.hasManage || permission.permission >= MANAGE_PERMISSIONS);

  const load = useCallback(async (kw: string, p: number, generation: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (kw) params.set('keyword', kw);
    params.set('page', String(p));
    params.set('pageSize', String(pageSize));
    const resp = await lcdx.get(`lcdx/cabinet/dxnum/${encodeURIComponent(userName())}?${params}`);
    if (generation !== generationRef.current) return;
    if (isOk(resp)) {
      setResult(resp.data as CabinetDxnumResult);
    } else {
      notice(t('Maimai2.DxnumPage.LoadFailed'));
      setResult(null);
    }
    setLoading(false);
  }, [pageSize, t]);

  useEffect(() => {
    if (!allowed) return;
    const generation = ++generationRef.current;
    void load(committed, page, generation);
  }, [allowed, committed, page, load]);

  const onSearch = () => {
    setPage(1);
    setCommitted(keyword.trim());
  };

  const onRefresh = () => {
    const generation = ++generationRef.current;
    void load(committed, page, generation);
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!allowed) {
    return (
      <div className="alert alert-warning">{t('Maimai2.DxnumPage.NoPermission')}</div>
    );
  }

  const items = result?.items ?? [];
  const windowMinutes = result?.playingWindowMinutes ?? 20;

  return (
    <div className="page-heading">
      <h2 className="card-title">{t('Maimai2.DxnumPage.Title')}</h2>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <input
          className="form-control"
          style={{ maxWidth: '16rem' }}
          placeholder={t('Maimai2.DxnumPage.Placeholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          maxLength={32}
          aria-label={t('Maimai2.DxnumPage.Keyword')}
        />
        <button className="btn btn-primary" onClick={onSearch} disabled={loading}>
          {t('Maimai2.DxnumPage.Search')}
        </button>
        <button className="btn btn-outline-secondary" onClick={onRefresh} disabled={loading}>
          {t('Maimai2.DxnumPage.Refresh')}
        </button>
      </div>

      {result && (
        <div className="text-muted small mb-2">
          {t('Maimai2.DxnumPage.Summary', { count: result.matchedCount })}
          <span className="ms-2">
            {t('Maimai2.DxnumPage.SummaryPageOnly', { page: result.page, size: result.pageSize })}
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="alert alert-info">{t('Maimai2.DxnumPage.NoMatch')}</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle">
            <thead>
              <tr>
                <th>{t('Maimai2.DxnumPage.ColCabinet')}</th>
                <th>{t('Maimai2.DxnumPage.ColLocation')}</th>
                <th>{t('Maimai2.DxnumPage.ColLcMode')}</th>
                <th className="text-center">{t('Maimai2.Cabinets.Today')}</th>
                <th className="text-center">{t('Maimai2.Cabinets.HalfHour')}</th>
                <th className="text-center">{t('Maimai2.Cabinets.OneHour')}</th>
                <th className="text-center">{t('Maimai2.Cabinets.TwoHour')}</th>
                <th className="text-center">{t('Maimai2.DxnumPage.ColPlaying')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const rowKey = `${item.nickName ?? ''}-${idx}`;
                const isOpen = expanded.has(rowKey);
                const playingCount = item.playing.length;
                return (
                  <Fragment key={rowKey}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => toggleExpand(rowKey)}>
                      <td>{item.nickName ?? '—'}</td>
                      <td>{item.locationName ?? '—'}</td>
                      <td>
                        {item.isSpecialMode > 0 ? (
                          <span className="badge text-bg-warning">LC</span>
                        ) : (
                          <span className="badge text-bg-secondary">—</span>
                        )}
                      </td>
                      <td className="text-center">{item.today.players}</td>
                      <td className="text-center">{item.halfHour.players}</td>
                      <td className="text-center">{item.oneHour.players}</td>
                      <td className="text-center">{item.twoHour.players}</td>
                      <td className="text-center">
                        <span className={`badge ${playingCount > 0 ? 'text-bg-success' : 'text-bg-light'}`}>
                          {playingCount}
                        </span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={8}>
                          <h6 className="mb-2">
                            {t('Maimai2.DxnumPage.Playing', { minutes: windowMinutes })}
                          </h6>
                          {playingCount > 0 ? (
                            <ul className="list-unstyled mb-0">
                              {item.playing.map((u) => (
                                <li key={u.userId}>
                                  {u.userName}{' '}
                                  <small className="text-muted">{formatClock(u.lastPlayDate)}</small>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {result && result.matchedCount > result.pageSize && (
        <Maimai2Pagination
          current={result.page}
          pageSize={result.pageSize}
          totalItems={result.matchedCount}
          onPageChange={(p) => setPage(p)}
        />
      )}
    </div>
  );
}
