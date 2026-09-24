import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { translate } from '@/lib/i18n';
import { getCurrentUser, loadUser } from '@/lib/user';
import { Maimai2PointExchangesDialog } from './Maimai2PointExchangesPage';
import type {
  ApiResponse,
  Maimai2ServerMission,
  Maimai2ServerMissionInfo,
  Maimai2ServerMissionPointChangelog,
  Maimai2ServerMissionPointData,
  Maimai2ServerMissionPointInfo,
  Maimai2ServerMissionRefreshCycle,
} from './server-mission-models';
import './Maimai2ServerMissionsPage.css';

const PAGE_SIZE = 10;

function responseData<T>(response: ApiResponse<T>): T | null {
  if (response?.status?.code === 92001 && response.data) return response.data;
  notice(translate('Common.OperationFailed'));
  return null;
}

function missionCompleted(mission: Maimai2ServerMission): boolean {
  return mission.conditionProgresses.every((condition) => condition.isDone);
}

function refreshCycleOrder(cycle: Maimai2ServerMissionRefreshCycle): number {
  switch (cycle) {
    case 'EveryDay': return 1;
    case 'EveryWeek': return 2;
    case 'EveryMonth': return 3;
    default: return 99;
  }
}

function refreshCycleText(cycle: Maimai2ServerMissionRefreshCycle): string {
  switch (cycle) {
    case 'None': return translate('Maimai2.ServerMissions.RefreshCycle.None');
    case 'EveryDay': return translate('Maimai2.ServerMissions.RefreshCycle.EveryDay');
    case 'EveryWeek': return translate('Maimai2.ServerMissions.RefreshCycle.EveryWeek');
    case 'EveryMonth': return translate('Maimai2.ServerMissions.RefreshCycle.EveryMonth');
    default: return cycle;
  }
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}:${twoDigits(date.getSeconds())}`;
}

/** Equivalent to the legacy Maimai DX server-missions component. */
export function Maimai2ServerMissionsPage() {
  const { t } = useTranslation();
  const [aimeId, setAimeId] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [missions, setMissions] = useState<Maimai2ServerMission[]>([]);
  const [pointLogs, setPointLogs] = useState<Maimai2ServerMissionPointChangelog[]>([]);
  const [pointLogTotal, setPointLogTotal] = useState(0);
  const [pointLogPage, setPointLogPage] = useState(0);
  const [pointData, setPointData] = useState<Maimai2ServerMissionPointData | null>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);

  async function loadPoints(id: string, page = 0) {
    try {
      const response = (await api.get('api/game/maimai2/userServerMissionPointInfo', {
        aimeId: id,
        page,
        size: PAGE_SIZE,
      })) as ApiResponse<Maimai2ServerMissionPointInfo>;
      const data = responseData(response);
      if (data) {
        setPointLogs(data.filterPointChangelogs);
        setPointLogPage(page);
        setPointLogTotal(data.changelogTotalCount);
        setPointData(data.userPointData);
      }
    } catch (error) {
      notice(t('Common.OperationFailed'));
    }
  }

  async function loadMissions(id: string) {
    try {
      const response = (await api.get('api/game/maimai2/userServerMissionInfo', {
        aimeId: id,
      })) as ApiResponse<Maimai2ServerMissionInfo>;
      const data = responseData(response);
      if (data) setMissions(data.serverMissionUserInfos);
    } catch (error) {
      notice(t('Common.OperationFailed'));
    }
  }

  async function load(id: string) {
    await Promise.all([loadPoints(id), loadMissions(id)]);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadUser();
        if (!active) return;
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        setAimeId(id);
        await load(id);
      } catch (error) {
        if (active) notice(t('Common.OperationFailed'));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredMissions = useMemo(() => {
    const visible = hideCompleted ? missions.filter((mission) => !missionCompleted(mission)) : [...missions];
    return visible.sort((first, second) => {
      const cycleOrder = refreshCycleOrder(first.refreshCycle) - refreshCycleOrder(second.refreshCycle);
      return cycleOrder || first.missionTitle.localeCompare(second.missionTitle);
    });
  }, [hideCompleted, missions]);

  const totalPages = Math.ceil(pointLogTotal / PAGE_SIZE);

  return (
    <div className="maimai2-server-missions-page">
      <h1 className="page-heading">{t('Maimai2.ServerMissions.Title')}</h1>

      <div className="server-missions-container">
        <div className="points-card">
          <div className="points-info">
            <div className="points-item">
              <span className="points-label">{t('Maimai2.ServerMissions.AvailablePoints')}</span>
              <span className="points-value available-points">{pointData?.availablePoints || 0}</span>
            </div>
            <div className="points-divider" />
            <div className="points-item">
              <span className="points-label">{t('Maimai2.ServerMissions.TotalPoints')}</span>
              <span className="points-value total-points">{pointData?.totalPoints || 0}</span>
            </div>
          </div>
          <div className="points-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setExchangeOpen(true)}>
              <i className="bi bi-gift" />{t('Maimai2.ServerMissions.Exchange')}
            </button>
          </div>
        </div>

        <div className="content">
          <div className="missions-section">
            <div className="section-header">
              <h3>{t('Maimai2.ServerMissions.MissionList')}</h3>
              <div className="form-check form-switch hide-completed-toggle">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="hideCompleted"
                  checked={hideCompleted}
                  onChange={(event) => setHideCompleted(event.target.checked)}
                />
                <label className="form-check-label" htmlFor="hideCompleted">{t('Maimai2.ServerMissions.HideCompleted')}</label>
              </div>
              <button className="btn btn-sm btn-outline-primary" onClick={() => void loadMissions(aimeId)}>
                <i className="bi bi-arrow-repeat" /> {t('Maimai2.ServerMissions.Refresh')}
              </button>
            </div>

            {missions.length > 0 ? (
              <div className="missions-grid">
                {filteredMissions.map((mission, missionIndex) => {
                  const completed = missionCompleted(mission);
                  return (
                    <div
                      className={`mission-card${completed ? ' completed-card' : ''}`}
                      key={`${mission.missionTitle}-${missionIndex}`}
                    >
                      <div className="mission-header">
                        <div className="mission-title-wrapper">
                          {completed && (
                            <span className="completed-tag"><i className="bi bi-check-circle-fill" /> {t('Maimai2.ServerMissions.Completed')}</span>
                          )}
                          <h4 className="mission-title">{mission.missionTitle}</h4>
                        </div>
                        <span className={`refresh-badge refresh-${mission.refreshCycle.toLowerCase()}`}>
                          {refreshCycleText(mission.refreshCycle)}
                        </span>
                      </div>
                      <div className="mission-description">{mission.missionDescription}</div>
                      <div className="condition-progresses">
                        {mission.conditionProgresses.map((condition, conditionIndex) => (
                          <div className="condition-item" key={`${condition.description}-${conditionIndex}`}>
                            {condition.total === 1 ? (
                              <div className="checkbox-container">
                                <div className="checkbox-wrapper">
                                  <div className={`custom-checkbox${condition.isDone ? ' checked' : ''}`} />
                                </div>
                                <div className="condition-desc">{condition.description}</div>
                              </div>
                            ) : (
                              <>
                                <div className="condition-desc">{condition.description}</div>
                                <div className="progress-container">
                                  <div className="progress-wrapper">
                                    <div className="progress">
                                      <div
                                        className={`progress-bar ${condition.isDone ? 'bg-success' : 'bg-warning'}`}
                                        style={{ width: `${(condition.current / condition.total) * 100}%` }}
                                        aria-valuenow={condition.current}
                                        aria-valuemax={condition.total}
                                      />
                                    </div>
                                    <div className="progress-values">
                                      <span className="current-value">{condition.current.toLocaleString()}</span>
                                      <span className="total-value">{condition.total.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mission-footer">
                        <div className="reward-info">
                          <span className="reward-label">{t('Maimai2.ServerMissions.Reward')}</span>
                          <span className="reward-description">{mission.rewardDescription}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state"><i className="bi bi-inbox" /><p>{t('Maimai2.ServerMissions.NoMissions')}</p></div>
            )}
          </div>

          <div className="changelog-section">
            <div className="section-header">
              <h3>{t('Maimai2.ServerMissions.ChangelogTitle')}</h3>
              <div className="changelog-controls">
                <span className="total-count">{t('Maimai2.ServerMissions.TotalRecords', { total: pointLogTotal })}</span>
                <button className="btn btn-sm btn-outline-primary" onClick={() => void loadPoints(aimeId, pointLogPage)}>
                  <i className="bi bi-arrow-repeat" /> {t('Maimai2.ServerMissions.Refresh')}
                </button>
              </div>
            </div>
            {pointLogs[0] && <div className="points-summary" />}
            {pointLogs.length > 0 ? (
              <div className="changelog-table-container">
                <table className="table table-hover">
                  <thead><tr><th>{t('Maimai2.ServerMissions.Table.Time')}</th><th>{t('Maimai2.ServerMissions.Table.Reason')}</th><th>{t('Maimai2.ServerMissions.Table.ChangedAmount')}</th></tr></thead>
                  <tbody>
                    {pointLogs.map((log, index) => (
                      <tr key={`${log.recordDate}-${index}`}>
                        <td>{formatDateTime(log.recordDate)}</td>
                        <td>{log.reason}</td>
                        <td className={log.changedAmount > 0 ? 'text-success' : log.changedAmount < 0 ? 'text-danger' : ''}>
                          {log.changedAmount > 0 && <span>+</span>}{log.changedAmount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><i className="bi bi-journal-text" /><p>{t('Maimai2.ServerMissions.NoChangelog')}</p></div>
            )}

            {pointLogTotal > PAGE_SIZE && (
              <div className="pagination-container">
                <nav aria-label={t('Maimai2.ServerMissions.PaginationLabel')}>
                  <ul className="pagination justify-content-center">
                    <li className={`page-item${pointLogPage === 0 ? ' disabled' : ''}`}>
                      <a className="page-link" onClick={() => pointLogPage > 0 && void loadPoints(aimeId, pointLogPage - 1)}>{t('Maimai2.ServerMissions.PreviousPage')}</a>
                    </li>
                    <li className="page-item active">
                      <span className="page-link">{t('Maimai2.ServerMissions.PageIndicator', { page: pointLogPage + 1, total: totalPages })}</span>
                    </li>
                    <li className={`page-item${pointLogPage >= totalPages - 1 ? ' disabled' : ''}`}>
                      <a className="page-link" onClick={() => pointLogPage < totalPages - 1 && void loadPoints(aimeId, pointLogPage + 1)}>{t('Maimai2.ServerMissions.NextPage')}</a>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>

      <Maimai2PointExchangesDialog
        open={exchangeOpen}
        onClose={() => {
          setExchangeOpen(false);
          void load(aimeId);
        }}
      />
    </div>
  );
}
