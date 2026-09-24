import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  CheckLg,
  ExclamationTriangleFill,
  People,
  QuestionLg,
  XLg,
} from 'react-bootstrap-icons';
import { BModal } from '@/components/shared/BModal';
import { confirm } from '@/components/shell/ConfirmDialog';
import { api, lcdx } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { StatusCode, isOk } from '@/lib/models';
import { getCurrentLang, langStore, translate } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { enableImages, maiAssetsHost } from '@/lib/utils';
import { fullWidth, padDigits } from '@/lib/format';
import { preloadStates, checkingUpdate, dbVersionStore, reload } from '@/lib/db/preload';
import { loadUser } from '@/lib/user';
import { Announcement } from '@/features/announcements/announcement';
import '@/features/announcements/AnnouncementDialog.css';
import './DashboardPage.css';

interface GameProfile {
  accessCode?: string;
  userName?: string;
  cardId?: number;
  characterId?: number;
  iconId?: number;
  level?: number;
  reincarnationNum?: number;
  playerRating?: number;
  newPlayerRating?: number;
  battlePoint?: number;
  overPowerRate?: number;
  totalAwake?: number;
  playCount?: number;
  lastRomVersion?: string;
  lastPlayDate?: string;
}

const MASK = '11001111000000000000';
function maskedLuid(full: string): string {
  let result = '';
  for (let i = 0; i < MASK.length; i++) {
    const char = MASK.at(i);
    if (char === '0') result += '*';
    else if (char === '1') result += full?.at(i) ?? '';
    else result += char as string;
  }
  return result;
}

/** 快速导航色块（等价旧版 dashboard.component.html 的 quick-navigate 区） */
const QUICK_NAV = [
  { to: '/mai2/recent', label: 'PlayRecord', className: 'mai2-playlog' },
  { to: '/mai2/rating', label: 'Rating', className: 'mai2-rating' },
  { to: '/mai2/profile', label: 'Profile', className: 'mai2-profile' },
  { to: '/mai2/photos', label: 'Photos', className: 'mai2-photo' },
] as const;

/** 等价旧版 dashboard.component */
export function DashboardPage() {
  const { t } = useTranslation();
  const lang = useStore(langStore);
  const states = useStore(preloadStates);
  const checking = useStore(checkingUpdate);
  const dbVersion = useStore(dbVersionStore);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcement2, setAnnouncement2] = useState<Announcement | null>(null);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);
  const [detail, setDetail] = useState<Announcement | null>(null);

  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState(false);
  const [noCard, setNoCard] = useState(false);
  const [currentCard, setCurrentCard] = useState<string | undefined>();
  const [mai2Profile, setMai2Profile] = useState<GameProfile | null>(null);
  const [unbinding, setUnbinding] = useState(false);
  // 解除绑定需要未脱敏的完整卡号，仅用于请求，不参与渲染
  const currentCardAccessCode = useRef<string | undefined>(undefined);

  const [globalPlayers, setGlobalPlayers] = useState<number | null>(null);
  const [globalPlayersWindow, setGlobalPlayersWindow] = useState(15);

  // 公告：LCDX 后端取最近两条（index=0/1），两条都返回后才结束骨架态
  useEffect(() => {
    let active = true;
    setLoadingAnnouncement(true);
    const loadAnnouncement = (index: number) =>
      lcdx
        .get('lcdx/announcement/recent', { lang: getCurrentLang(), index })
        .then((resp) => {
          if (!active || !resp?.status) return;
          if (resp.status.code === StatusCode.OK && resp.data) {
            const parsed = Announcement.fromJSON(resp.data);
            if (index === 0) setAnnouncement(parsed);
            else setAnnouncement2(parsed);
          } else {
            notice(translate('DashboardPage.OperationFailed'));
          }
        })
        .catch(() => {
          if (active) notice(translate('Common.OperationFailed'));
        });
    void Promise.allSettled([loadAnnouncement(0), loadAnnouncement(1)]).then(() => {
      if (active) setLoadingAnnouncement(false);
    });
    return () => {
      active = false;
    };
  }, [lang]);

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    setProfilesError(false);
    setNoCard(false);
    setMai2Profile(null);
    setCurrentCard(undefined);
    currentCardAccessCode.current = undefined;
    try {
      const resp = await api.get('api/user/profiles');
      if (resp?.status) {
        if (resp.status.code === StatusCode.OK && resp.data) {
          setMai2Profile(resp.data.maimai2 ?? null);
          const accessCode =
            resp.data.maimai2?.accessCode || resp.data.chusan?.accessCode || resp.data.ongeki?.accessCode;
          if (accessCode) {
            currentCardAccessCode.current = accessCode;
            setCurrentCard(maskedLuid(accessCode));
          }
        } else if (resp.status.code === StatusCode.NOT_FOUND) {
          setNoCard(true);
        } else {
          notice(translate('DashboardPage.OperationFailed'));
          setProfilesError(true);
        }
      }
    } catch {
      notice(translate('Common.OperationFailed'));
      setProfilesError(true);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  // 全服游玩人数：30 秒轮询（等价旧版 dashboard.component.ts 的 globalPlayersRefreshTimer）
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void lcdx
        .get('lcdx/cabinet/global-players')
        .then((resp) => {
          if (!active || !isOk(resp) || !resp.data) return;
          setGlobalPlayers(resp.data.players);
          setGlobalPlayersWindow(resp.data.windowMinutes);
        })
        .catch(() => {
          // 全服人数是辅助信息，探测失败时保持上一次的值（与旧版一致）
        });
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const onUnbindCard = async () => {
    const accessCode = currentCardAccessCode.current;
    if (!accessCode || unbinding) return;
    const confirmed = await confirm({
      title: t('DashboardPage.UnbindGameAccount'),
      message: t('DashboardPage.UnbindGameAccountTip'),
      yesText: t('DashboardPage.ConfirmUnbind'),
      noText: t('Common.Cancel'),
    });
    if (!confirmed) return;

    setUnbinding(true);
    try {
      const resp = await api.post('api/user/unbindCard', { accessCode });
      if (resp?.status?.code === StatusCode.OK) {
        await loadUser(true).catch(() => null);
        await loadProfiles();
      } else {
        notice(translate('DashboardPage.OperationFailed'));
      }
    } catch {
      notice(translate('Common.OperationFailed'));
    } finally {
      setUnbinding(false);
    }
  };

  // 预载任务统计（16 项）
  const preloadStats = useMemo(() => {
    const values = Object.values(states);
    const total = 16;
    const downloading = values.filter((s) => s === 'Downloading').length;
    const completed = values.filter((s) => s === 'OK').length;
    const error = values.filter((s) => s === 'Error').length;
    const loadingDatabase = completed + error < total;
    return { total, downloading, completed, error, loadingDatabase };
  }, [states]);

  const announcementPlaceholder = (
    <div className="placeholder-glow my-1">
      <div>
        <span className="placeholder fw-light text-secondary" style={{ width: '8em' }} />
      </div>
      <h4 className="placeholder" style={{ width: '12em' }} />
    </div>
  );

  const announcementEntry = (item: Announcement) => (
    <div className="my-1" onClick={() => setDetail(item)}>
      <div className="fw-light text-secondary mb-1">{item.updatedAt.toLocaleDateString()}</div>
      <h4>{item.title}</h4>
    </div>
  );

  return (
    <div className="content dashboard-page">
      <h1 className="page-heading">{t('DashboardPage.Title')}</h1>
      <div className="row">
        <div className="col-12 col-lg-8">
          <div className="mb-3 d-flex justify-content-between align-items-end">
            <h3 className="m-0">{t('DashboardPage.LatestAnnouncement')}</h3>
            <Link className="more-announcements" to="/announcements">
              {t('DashboardPage.More')}
            </Link>
          </div>

          <div className="card-btn card mb-3 user-select-none">
            <div className="card-body py-2">
              {loadingAnnouncement ? announcementPlaceholder : announcement ? announcementEntry(announcement) : null}
              <hr />
              {loadingAnnouncement
                ? announcementPlaceholder
                : announcement2
                  ? announcementEntry(announcement2)
                  : null}
            </div>
          </div>

          <h3 className="mb-3">{t('DashboardPage.QuickNavigate')}</h3>
          <div className="row mb-3 g-2">
            {QUICK_NAV.map((item) => (
              <div className="col-6 col-sm-4 col-md-3 col-lg-4 col-xxl-3" key={item.to}>
                <Link
                  to={item.to}
                  className={`card-btn rounded-3 quick-navigate ${item.className} user-select-none`}
                >
                  {t('DashboardPage.' + item.label)}
                </Link>
              </div>
            ))}
          </div>

          <div className="mb-3 d-flex justify-content-between align-items-center gap-3">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h3 className="m-0">{t('DashboardPage.Profiles')}</h3>
              {!loadingProfiles && currentCard && <code className="small">({currentCard})</code>}
            </div>
            {!loadingProfiles && currentCard && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm flex-shrink-0"
                disabled={unbinding}
                onClick={() => void onUnbindCard()}
              >
                {t('DashboardPage.UnbindGameAccount')}
              </button>
            )}
          </div>

          {loadingProfiles && (
            <div className="card mb-3 placeholder-wave">
              <div className="card-header">
                <span className="placeholder" style={{ width: '6em' }} />
              </div>
              <div className="card-body p-2">
                <div className="hstack gap-2">
                  <div className="placeholder profile-icon" />
                  <table className="profile-table">
                    <tbody>
                      <tr>
                        <th>
                          <span className="placeholder" style={{ width: '3em' }} />
                        </th>
                        <td>
                          <span className="placeholder" style={{ width: '2em' }} />
                        </td>
                      </tr>
                      <tr>
                        <th>
                          <span className="placeholder" style={{ width: '4em' }} />
                        </th>
                        <td>
                          <span className="placeholder" style={{ width: '5em' }} />
                        </td>
                      </tr>
                      <tr>
                        <th>
                          <span className="placeholder" style={{ width: '3em' }} />
                        </th>
                        <td>
                          <span className="placeholder" style={{ width: '3em' }} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card-footer">
                <div className="float-end fw-bold small">
                  <span className="placeholder" style={{ width: '14em' }} />
                </div>
              </div>
            </div>
          )}

          {noCard && (
            <div
              className="alert alert-warning d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
              role="alert"
            >
              <div className="d-flex align-items-center">
                <ExclamationTriangleFill className="me-2 flex-shrink-0" />
                <span>{t('DashboardPage.NoCardMessage')}</span>
              </div>
              <Link className="btn btn-warning flex-shrink-0" to="/netcode-bind">
                {t('DashboardPage.BindGameAccount')}
              </Link>
            </div>
          )}

          {profilesError && (
            <div className="alert alert-danger" role="alert">
              {t('DashboardPage.ProfileLoadFailed')}
            </div>
          )}

          {!loadingProfiles && !noCard && !profilesError && !mai2Profile && (
            <div className="card mb-3">
              <div className="card-body">{t('DashboardPage.NoProfileMessage')}</div>
            </div>
          )}

          {mai2Profile && (
            <div className="card mb-3">
              <div className="card-header fw-bold d-flex align-items-center gap-2">
                <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024">
                  <use href="assets/mai2.svg#icon" />
                </svg>
                {fullWidth(mai2Profile.userName ?? '')}
              </div>
              <div className="card-body p-2">
                <div className="hstack gap-2">
                  {enableImages && (
                    <img
                      className="profile-icon"
                      src={maiAssetsHost + `assets/mai2/icon/UI_Icon_${padDigits(mai2Profile.iconId ?? 0, 6)}.webp`}
                      alt=""
                    />
                  )}
                  <table className="profile-table">
                    <tbody>
                      <tr>
                        <th>{t('DashboardPage.AwakenLevel')}</th>
                        <td>{mai2Profile.totalAwake}</td>
                      </tr>
                      <tr>
                        <th>{t('DashboardPage.Rating')}</th>
                        <td>{mai2Profile.playerRating}</td>
                      </tr>
                      <tr>
                        <th>{t('DashboardPage.PlayCount')}</th>
                        <td>{mai2Profile.playCount}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card-footer">
                <div className="float-end fw-bold small">
                  {t('DashboardPage.LastPlay')}
                  {t('Common.Colon')}
                  {new Date(mai2Profile.lastPlayDate ?? '').toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="col-12 col-lg-4">
          <h3 className="mb-3">{t('DashboardPage.GameData')}</h3>
          <div className="card mb-3">
            <div className="card-body">
              {(checking === 'checking' || (preloadStats.loadingDatabase && preloadStats.downloading === 0)) && (
                <div className="mb-2">
                  <span className="pe-2">{t('DashboardPage.CheckingUpdate')}</span>
                  <span className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </span>
                </div>
              )}
              {checking !== 'checking' && preloadStats.loadingDatabase && preloadStats.downloading > 0 && (
                <div className="d-flex align-items-center mb-2">
                  <span className="pe-2">
                    {t('DashboardPage.Downloading')}
                    {t('Common.Colon')}
                    {preloadStats.completed}/{preloadStats.total}
                  </span>
                  <span className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </span>
                </div>
              )}
              {checking === 'completed' && !preloadStats.loadingDatabase && preloadStats.error === 0 && (
                <div className="d-flex align-items-center mb-2">
                  <CheckLg className="d-flex align-items-center me-2 text-success" />
                  <span>
                    {t('DashboardPage.Version')}
                    {t('Common.Colon')}
                    {dbVersion}
                  </span>
                </div>
              )}
              {checking === 'error' && !preloadStats.loadingDatabase && preloadStats.error === 0 && (
                <div className="d-flex align-items-center mb-2">
                  <QuestionLg className="d-flex align-items-center me-2 text-warning" />
                  <span>
                    {t('DashboardPage.Version')}
                    {t('Common.Colon')}
                    {dbVersion}
                  </span>
                </div>
              )}
              {checking !== 'checking' && !preloadStats.loadingDatabase && preloadStats.error > 0 && (
                <div className="d-flex align-items-center mb-2">
                  <XLg className="d-flex align-items-center me-2 text-danger" />
                  <span>
                    {t('DashboardPage.DownloadFailed')}
                    {t('Common.Colon')}
                    {preloadStats.completed}/{preloadStats.total}
                  </span>
                </div>
              )}
              <button
                type="button"
                disabled={checking === 'checking' || preloadStats.loadingDatabase}
                className="btn btn-danger btn-sm mt-1"
                onClick={() => void reload()}
              >
                {t('DashboardPage.Reload')}
              </button>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex align-items-center gap-2 mb-3">
                <People />
                <h3 className="h6 fw-semibold mb-0">{t('DashboardPage.GlobalPlayers')}</h3>
              </div>
              {globalPlayers === null ? (
                <div className="placeholder-glow" aria-hidden="true">
                  <span className="placeholder col-5 fs-2" />
                </div>
              ) : (
                <div className="display-5 fw-semibold lh-1">{globalPlayers}</div>
              )}
              <div className="small text-body-secondary mt-2">
                {t('DashboardPage.GlobalPlayersWindow', { minutes: globalPlayersWindow })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <BModal className="announcement-detail-dialog" open={!!detail} onClose={() => setDetail(null)} scrollable>
        {detail && (
          <div
            className="announcement-content"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(marked.parse(detail.getLocalContent(getCurrentLang())) as string),
            }}
          />
        )}
      </BModal>
    </div>
  );
}
