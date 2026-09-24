import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { lcdx } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { isOk } from '@/lib/models';
import { getCurrentUser, loadUser } from '@/lib/user';
import type {
  CabinetInfo,
  CabinetPlayers,
  CabinetSummary,
  DeliveryStatus,
  DownloadProgress,
} from './cabinet-models';
import {
  formatClock,
  formatFullDateTime,
  formatShortDateTime,
  truncateFileName,
} from './cabinet-models';

const REFRESH_MS = 30_000;

/**
 * 等价旧版 maimai2-cabinets（页① 机台管理，设计 §8）：
 * EP-19 机台下拉 + 四卡片（EP-04 状态 / EP-05 人数 / EP-06 配信 / EP-07 进度）
 * + 手动刷新 + 30s 自动刷新开关。
 */

/** 等价旧版 progressBadgeClass（Done 成功；Error/HashError/Incomplete 危险；其余信息色） */
function progressBadgeClass(progressText: string): string {
  if (progressText === 'Done') {
    return 'text-bg-success';
  }
  if (progressText === 'Error' || progressText === 'HashError' || progressText === 'Incomplete') {
    return 'text-bg-danger';
  }
  return 'text-bg-info';
}

export function Maimai2CabinetsPage() {
  const { t } = useTranslation();

  const [cabinets, setCabinets] = useState<CabinetSummary[]>([]);
  const [selectedNick, setSelectedNick] = useState('');
  const [info, setInfo] = useState<CabinetInfo | null>(null);
  const [players, setPlayers] = useState<CabinetPlayers | null>(null);
  const [delivery, setDelivery] = useState<DeliveryStatus | null>(null);
  const [dlprog, setDlprog] = useState<DownloadProgress | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  /** selectedNick 的最新值（自动刷新定时器内使用，避免闭包过期） */
  const selectedNickRef = useRef(selectedNick);
  selectedNickRef.current = selectedNick;

  const userName = () => getCurrentUser()?.username ?? '';

  const loadInfo = useCallback(async (nick: string) => {
    const resp = await lcdx.get(
      `lcdx/cabinet/info/${encodeURIComponent(userName())}/${encodeURIComponent(nick)}`,
    );
    setInfo(isOk(resp) ? (resp.data as CabinetInfo) : null);
  }, []);

  const loadPlayers = useCallback(async (nick: string) => {
    const resp = await lcdx.get(
      `lcdx/cabinet/players/${encodeURIComponent(userName())}/${encodeURIComponent(nick)}`,
    );
    setPlayers(isOk(resp) ? (resp.data as CabinetPlayers) : null);
  }, []);

  const loadDelivery = useCallback(async (nick: string) => {
    const resp = await lcdx.get(
      `lcdx/cabinet/delivery/${encodeURIComponent(userName())}/${encodeURIComponent(nick)}`,
    );
    setDelivery(isOk(resp) ? (resp.data as DeliveryStatus) : null);
  }, []);

  const loadDlprog = useCallback(async (nick: string) => {
    const resp = await lcdx.get(
      `lcdx/cabinet/dlprog/${encodeURIComponent(userName())}/${encodeURIComponent(nick)}`,
    );
    setDlprog(isOk(resp) ? (resp.data as DownloadProgress) : null);
  }, []);

  /** 四卡片并行刷新（等价旧版 refreshAll） */
  const refreshAll = useCallback(
    (nick: string) => {
      if (!nick) {
        return;
      }
      void Promise.all([loadInfo(nick), loadPlayers(nick), loadDelivery(nick), loadDlprog(nick)]);
    },
    [loadInfo, loadPlayers, loadDelivery, loadDlprog],
  );

  /** EP-19 可控机台列表（等价旧版 loadCabinets） */
  const loadCabinets = useCallback(async () => {
    try {
      await loadUser();
      const resp = await lcdx.get(`lcdx/cabinet/controllable/${encodeURIComponent(userName())}`);
      if (isOk(resp) && Array.isArray(resp.data)) {
        const list = resp.data as CabinetSummary[];
        setCabinets(list);
        setSelectedNick((prev) => {
          const stillListed = list.some((c) => (c.nickName ?? c.fullKeychip) === prev);
          if (stillListed) {
            return prev;
          }
          const first = list[0];
          return first ? (first.nickName ?? first.fullKeychip) : '';
        });
      }
    } catch {
      notice(t('Maimai2.CabinetsPage.LoadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void loadCabinets();
  }, [loadCabinets]);

  /** 选中机台变化（含初次默认选中）→ 四卡片刷新（等价旧版 onCabinetChange + 自动选中） */
  useEffect(() => {
    if (selectedNick) {
      refreshAll(selectedNick);
    }
  }, [selectedNick, refreshAll]);

  /** 30s 自动刷新（等价旧版 toggleAutoRefresh/stopAutoRefresh 的 interval 生命周期） */
  useEffect(() => {
    if (!autoRefresh) {
      return;
    }
    const timer = setInterval(() => refreshAll(selectedNickRef.current), REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshAll]);

  return (
    <>
      <h1 className="page-heading">{t('Maimai2.CabinetsPage.Title')}</h1>

      {cabinets.length === 0 ? (
        <div className="alert alert-info">{t('Maimai2.CabinetsPage.NoCabinets')}</div>
      ) : (
        <>
          <div className="row mb-3 align-items-center">
            <div className="col-md-5">
              <select
                className="form-select"
                value={selectedNick}
                onChange={(event) => setSelectedNick(event.target.value)}
              >
                {cabinets.map((cab) => {
                  const value = cab.nickName ?? cab.fullKeychip;
                  return (
                    <option key={cab.fullKeychip} value={value}>
                      {cab.nickName || cab.fullKeychip}
                      {cab.locationName ? ` (${cab.locationName})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="col-md-auto">
              <button className="btn btn-primary" onClick={() => refreshAll(selectedNick)}>
                {t('Maimai2.CabinetsPage.Refresh')}
              </button>
            </div>
            <div className="col-md-auto">
              <div className="form-check form-switch ms-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />
                <label className="form-check-label" htmlFor="autoRefresh">
                  {t('Maimai2.CabinetsPage.AutoRefresh')}
                </label>
              </div>
            </div>
          </div>

          <div className="row">
            {/* 机台状态 */}
            <div className="col-xl-6 mb-4">
              <div className="card shadow h-100">
                <div className="card-header">
                  <h5 className="mb-0">{t('Maimai2.CabinetsPage.InfoCard')}</h5>
                </div>
                <div className="card-body">
                  {info ? (
                    <>
                      <ul className="list-unstyled mb-0">
                        <li>
                          <strong>{t('Maimai2.Cabinets.Place')}:</strong> {info.locationName}
                        </li>
                        <li>
                          <strong>{t('Maimai2.Cabinets.Level')}:</strong> {info.level}
                        </li>
                        <li>
                          <strong>{t('Maimai2.Cabinets.LCMode')}:</strong> {info.isSpecialMode}
                        </li>
                        <li>
                          <strong>{t('Maimai2.Cabinets.Rebooting')}:</strong>{' '}
                          {info.isRebooting ? (
                            <span className="badge text-bg-warning">
                              {t('Maimai2.Cabinets.RebootPending')}
                            </span>
                          ) : (
                            <span className="badge text-bg-secondary">
                              {t('Maimai2.Cabinets.Idle')}
                            </span>
                          )}
                        </li>
                        <li>
                          <strong>{t('Maimai2.Cabinets.LastOnline')}:</strong>{' '}
                          {formatFullDateTime(info.lastOnline)}
                        </li>
                        <li>
                          <strong>{t('Maimai2.Cabinets.Memory')}:</strong> {info.currentMemoryUsage}{' '}
                          / {info.currentSinmaiMemoryUsage} MB
                        </li>
                        {info.pagefileMessage && (
                          <li>
                            <strong>Pagefile:</strong> {info.pagefileMessage}
                          </li>
                        )}
                      </ul>
                      {info.settings.length > 0 && (
                        <>
                          <hr />
                          <h6>{t('Maimai2.Cabinets.EnabledSettings')}</h6>
                          <ul className="list-unstyled mb-0 small">
                            {info.settings.map((s) => (
                              <li key={s.settingName}>
                                <code>{s.settingName}</code> = {s.settingValue}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-muted mb-0">{t('Maimai2.Cabinets.Loading')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 上机人数 */}
            <div className="col-xl-6 mb-4">
              <div className="card shadow h-100">
                <div className="card-header">
                  <h5 className="mb-0">{t('Maimai2.CabinetsPage.PlayersCard')}</h5>
                </div>
                <div className="card-body">
                  {players ? (
                    <>
                      <div className="row text-center mb-3">
                        <div className="col-3">
                          <div className="fs-4">{players.today.players}</div>
                          <div className="text-muted small">
                            {t('Maimai2.Cabinets.Today')} ({players.today.plays})
                          </div>
                        </div>
                        <div className="col-3">
                          <div className="fs-4">{players.halfHour.players}</div>
                          <div className="text-muted small">
                            {t('Maimai2.Cabinets.HalfHour')} ({players.halfHour.plays})
                          </div>
                        </div>
                        <div className="col-3">
                          <div className="fs-4">{players.oneHour.players}</div>
                          <div className="text-muted small">
                            {t('Maimai2.Cabinets.OneHour')} ({players.oneHour.plays})
                          </div>
                        </div>
                        <div className="col-3">
                          <div className="fs-4">{players.twoHour.players}</div>
                          <div className="text-muted small">
                            {t('Maimai2.Cabinets.TwoHour')} ({players.twoHour.plays})
                          </div>
                        </div>
                      </div>
                      {players.playing.length > 0 && (
                        <>
                          <h6>{t('Maimai2.Cabinets.NowPlaying')}</h6>
                          <ul className="list-unstyled mb-0">
                            {players.playing.map((u) => (
                              <li key={u.userId}>
                                {u.userName}{' '}
                                <small className="text-muted">{formatClock(u.lastPlayDate)}</small>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-muted mb-0">{t('Maimai2.Cabinets.Loading')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 配信状态 */}
            <div className="col-xl-6 mb-4">
              <div className="card shadow h-100">
                <div className="card-header">
                  <h5 className="mb-0">{t('Maimai2.CabinetsPage.DeliveryCard')}</h5>
                </div>
                <div className="card-body">
                  {delivery ? (
                    <>
                      {!delivery.app && !delivery.option && (
                        <p className="text-muted mb-0">{t('Maimai2.Cabinets.NoDelivery')}</p>
                      )}
                      {delivery.app && (
                        <>
                          <h6>{t('Maimai2.Cabinets.AppDelivery')}</h6>
                          <ul className="list-unstyled small">
                            <li>
                              RF: {delivery.app.rfState}
                              {delivery.app.deliveryTitle ? ` — ${delivery.app.deliveryTitle}` : ''}
                            </li>
                            {(delivery.app.currentVersion || delivery.app.deliveryVersion) && (
                              <li>
                                {delivery.app.currentVersion || '-'} →{' '}
                                {delivery.app.deliveryVersion || '-'}
                              </li>
                            )}
                            {delivery.app.totalSize > 0 && (
                              <li>
                                {t('Maimai2.Cabinets.Progress')}: {delivery.app.downloadedSize}/
                                {delivery.app.totalSize}
                              </li>
                            )}
                            {delivery.app.startTime && (
                              <li>
                                {t('Maimai2.Cabinets.StartTime')}:{' '}
                                {formatShortDateTime(delivery.app.startTime)}
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                      {delivery.option && (
                        <>
                          <h6 className="mt-2">{t('Maimai2.Cabinets.OptionDelivery')}</h6>
                          <ul className="list-unstyled small mb-0">
                            <li>
                              RF: {delivery.option.rfState}
                              {delivery.option.deliveryTitle
                                ? ` — ${delivery.option.deliveryTitle}`
                                : ''}
                            </li>
                            {(delivery.option.currentVersion || delivery.option.deliveryVersion) && (
                              <li>
                                {delivery.option.currentVersion || '-'} →{' '}
                                {delivery.option.deliveryVersion || '-'}
                              </li>
                            )}
                            {delivery.option.totalSize > 0 && (
                              <li>
                                {t('Maimai2.Cabinets.Progress')}: {delivery.option.downloadedSize}/
                                {delivery.option.totalSize}
                              </li>
                            )}
                            {delivery.option.startTime && (
                              <li>
                                {t('Maimai2.Cabinets.StartTime')}:{' '}
                                {formatShortDateTime(delivery.option.startTime)}
                              </li>
                            )}
                          </ul>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-muted mb-0">{t('Maimai2.Cabinets.Loading')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 下载进度 */}
            <div className="col-xl-6 mb-4">
              <div className="card shadow h-100">
                <div className="card-header">
                  <h5 className="mb-0">{t('Maimai2.CabinetsPage.DlprogCard')}</h5>
                </div>
                <div className="card-body">
                  {dlprog?.items?.length ? (
                    <ul className="list-unstyled mb-0">
                      {dlprog.items.map((item) => (
                        <li
                          className="d-flex justify-content-between align-items-center py-1"
                          key={item.fileName + item.reportDate}
                        >
                          <span title={item.fileName}>{truncateFileName(item.fileName)}</span>
                          <span className={`badge ${progressBadgeClass(item.progressText)}`}>
                            {item.progressText}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted mb-0">{t('Maimai2.Cabinets.NoDownloads')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
