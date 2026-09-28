import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, createBrowserRouter, useLocation, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/shell/AppShell';
import { getAccount } from '@/lib/auth/account';
import { restoreAccess } from '@/lib/auth/access';
import { isAdmin, loadUser, userStore } from '@/lib/user';
import { useStore } from '@/lib/store';
import { notice } from '@/lib/message';
import { MANAGE_GRANTS, useBotPermission } from '@/lib/botPermission';
import { HomePage } from '@/pages/HomePage';
import { SignInPage } from '@/pages/auth/SignInPage';
import { SignUpPage } from '@/pages/auth/SignUpPage';
import { PasswordResetPage } from '@/pages/auth/PasswordResetPage';
import { OauthCallbackPage } from '@/pages/auth/OauthCallbackPage';
import { BannedPage } from '@/pages/BannedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ContributorsPage } from '@/pages/ContributorsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { CardsPage } from '@/pages/CardsPage';
import { KeychipPage } from '@/pages/KeychipPage';
import { ImporterPage } from '@/pages/ImporterPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { AnnouncementEditPage } from '@/pages/AnnouncementEditPage';
import { AdminPage } from '@/pages/AdminPage';
import { NetcodeBindPage } from '@/pages/NetcodeBindPage';
import { OnetimeSignInPage } from '@/pages/auth/OnetimeSignInPage';
import { OngekiProfilePage } from '@/features/ongeki/OngekiProfilePage';
import { OngekiBattlePage } from '@/features/ongeki/OngekiBattlePage';
import { OngekiRivalPage } from '@/features/ongeki/OngekiRivalPage';
import { OngekiMusicRankingPage } from '@/features/ongeki/OngekiMusicRankingPage';
import { OngekiUserRankingPage } from '@/features/ongeki/OngekiUserRankingPage';
import { OngekiRecentPage } from '@/features/ongeki/OngekiRecentPage';
import { OngekiSettingPage } from '@/features/ongeki/OngekiSettingPage';
import { OngekiRatingPage } from '@/features/ongeki/OngekiRatingPage';
import { OngekiSongListPage } from '@/features/ongeki/OngekiSongListPage';
import { OngekiCardPage } from '@/features/ongeki/OngekiCardPage';
import { OngekiCardGalleryPage } from '@/features/ongeki/OngekiCardGalleryPage';
import { Maimai2ProfilePage } from '@/features/mai2/Maimai2ProfilePage';
import { Maimai2PhotosPage } from '@/features/mai2/Maimai2PhotosPage';
import { Maimai2DxPassPage } from '@/features/mai2/Maimai2DxPassPage';
import { Maimai2RivalPage } from '@/features/mai2/Maimai2RivalPage';
import { Maimai2CabinetsPage } from '@/features/mai2/Maimai2CabinetsPage';
import { Maimai2RemoteControlPage } from '@/features/mai2/Maimai2RemoteControlPage';
import { Maimai2LocksPage } from '@/features/mai2/Maimai2LocksPage';
import { Maimai2CabmodePage } from '@/features/mai2/Maimai2CabmodePage';
import { Maimai2KopRankingPage } from '@/features/mai2/Maimai2KopRankingPage';
import { Maimai2SettingPage } from '@/features/mai2/Maimai2SettingPage';
import { Maimai2SongListPage } from '@/features/mai2/Maimai2SongListPage';
import { Maimai2RecentPage } from '@/features/mai2/Maimai2RecentPage';
import { Maimai2RatingPage } from '@/features/mai2/Maimai2RatingPage';
import { Maimai2ServerMissionsPage } from '@/features/mai2/Maimai2ServerMissionsPage';
import { Maimai2PointExchangesPage } from '@/features/mai2/Maimai2PointExchangesPage';
import { Maimai2CirclePage } from '@/features/mai2/Maimai2CirclePage';
import { Maimai2FestaPage } from '@/features/mai2/Maimai2FestaPage';
import { ChuniV2ProfilePage } from '@/features/chuni/ChuniV2ProfilePage';
import { ChuniV2UserRankingPage } from '@/features/chuni/ChuniV2UserRankingPage';
import { ChuniV2RatingPage } from '@/features/chuni/ChuniV2RatingPage';
import { ChuniV2RecentPage } from '@/features/chuni/ChuniV2RecentPage';
import { ChuniV2SettingPage } from '@/features/chuni/ChuniV2SettingPage';
import { ChuniV2SongListPage } from '@/features/chuni/ChuniV2SongListPage';
import { ChuniV2SongRankingPage } from '@/features/chuni/ChuniV2SongRankingPage';
import { ChuniV2CharacterPage } from '@/features/chuni/ChuniV2CharacterPage';
import { ChuniV2RivalPage } from '@/features/chuni/ChuniV2RivalPage';
import { ChuniV2UserBoxPage } from '@/features/chuni/ChuniV2UserBoxPage';

/** Auth guards (equivalent to legacy auth-guard/login-guard services) */
function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const account = getAccount();

  useEffect(() => {
    if (!account) return;
    void restoreAccess().then((status) => {
      if (status?.banned) window.location.assign('/banned');
    });
  }, [account]);

  if (!account) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

function RequireGuest({ children }: { children: ReactNode }) {
  const account = getAccount();
  if (account) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

/** Admin routes must not mount (and therefore must not issue admin API calls)
 * until the cached/current user has been checked for ROLE_ADMIN. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const account = getAccount();
  const user = useStore(userStore);
  const [loadingUser, setLoadingUser] = useState(() => Boolean(account && !user));

  useEffect(() => {
    if (!account || user) {
      setLoadingUser(false);
      return;
    }
    let active = true;
    setLoadingUser(true);
    void loadUser()
      .catch(() => null)
      .finally(() => {
        if (active) setLoadingUser(false);
      });
    return () => {
      active = false;
    };
  }, [account, user]);

  if (!account) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  if (loadingUser || !user) return null;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

/** 机台管理路由守卫（等价旧版 CabinetManageGuard）：EP-18 hasManage 门控。
 * 未登录 → 首页；探测未完成放行（页面内空列表兜底，避免闪烁跳转）；无权限 → 提示并回仪表板。
 * 安全边界仍在后端 L2/L3，守卫仅为 UX。 */
export function RequireCabinetManage({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { t } = useTranslation();
  const account = getAccount();
  const permission = useBotPermission();
  const denied = Boolean(account) && permission.loaded && !permission.hasManage;

  useEffect(() => {
    if (denied) {
      notice(t('Common.NoCabinetPermission'));
    }
  }, [denied, t]);

  if (!account) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  if (denied) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

/** 页④ 操作记录与授权（等价旧版 CabinetAdminGuard）：P≥4（机台管理授权；
 * Admin 授权卡 P≥7 由页面内部再分档） */
export function RequireCabinetAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { t } = useTranslation();
  const account = getAccount();
  const permission = useBotPermission();
  const denied = Boolean(account) && permission.loaded && permission.permission < MANAGE_GRANTS;

  useEffect(() => {
    if (denied) {
      notice(t('Common.NoCabinetPermission'));
    }
  }, [denied, t]);

  if (!account) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  if (denied) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage />, handle: { title: 'HomePage.Title', disableSidebar: true } },
      { path: '/profile', element: auth(<ProfilePage />), handle: { title: 'ProfilePage.Title' } },
      { path: '/cards', element: auth(<CardsPage />), handle: { title: 'CardsPage.Title' } },
      { path: '/keychip', element: auth(<KeychipPage />), handle: { title: 'KeychipPage.Title' } },
      { path: '/dashboard', element: auth(<DashboardPage />), handle: { title: 'DashboardPage.Title' } },
      { path: '/import', element: auth(<ImporterPage />), handle: { title: 'ImportPage.Title' } },
      { path: '/announcements', element: auth(<AnnouncementsPage />), handle: { title: 'AnnouncementsPage.Title' } },
      { path: '/announcements/edit', element: auth(<AnnouncementEditPage />), handle: { title: 'AnnouncementsPage.DraftNew' } },
      { path: '/contributors', element: <ContributorsPage />, handle: { title: 'ContributorsPage.Title', disableSidebar: true } },

      // ongeki (canMatch: AuthGuard)
      {
        path: '/ongeki',
        element: auth(<Outlet />),
        handle: { title: 'Common.Ongeki' },
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <OngekiProfilePage />, handle: { title: 'Ongeki.ProfilePage.Title' } },
          { path: 'recent', element: <OngekiRecentPage />, handle: { title: 'Ongeki.RecentPage.Title' } },
          { path: 'song', element: <OngekiSongListPage />, handle: { title: 'Ongeki.MusicList.Title' } },
          { path: 'battle', element: <OngekiBattlePage />, handle: { title: 'Ongeki.BattlePointPage.Title' } },
          { path: 'rating', element: <OngekiRatingPage />, handle: { title: 'Ongeki.RatingPage.Title' } },
          { path: 'card/gallery', element: <OngekiCardGalleryPage />, handle: { title: 'Ongeki.CardGallery.Title' } },
          { path: 'card', element: <OngekiCardPage />, handle: { title: 'Ongeki.Card.Title' } },
          { path: 'rival', element: <OngekiRivalPage />, handle: { title: 'Ongeki.RivalPage.Title' } },
          { path: 'musicRanking', element: <OngekiMusicRankingPage />, handle: { title: 'Ongeki.MusicRankingPage.Title' } },
          { path: 'userRanking', element: <OngekiUserRankingPage />, handle: { title: 'Ongeki.UserRankingPage.Title' } },
          { path: 'settings', element: <OngekiSettingPage />, handle: { title: 'Ongeki.SettingsPage.Title' } },
        ],
      },

      // maimai2
      {
        path: '/mai2',
        element: auth(<Outlet />),
        handle: { title: 'Common.Mai2' },
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <Maimai2ProfilePage />, handle: { title: 'Maimai2.ProfilePage.Title' } },
          { path: 'setting', element: <Maimai2SettingPage />, handle: { title: 'Maimai2.Setting.Title' } },
          { path: 'recent', element: <Maimai2RecentPage />, handle: { title: 'Maimai2.RecentPage.Title' } },
          { path: 'rating', element: <Maimai2RatingPage />, handle: { title: 'Maimai2.RatingPage.Title' } },
          { path: 'photos', element: <Maimai2PhotosPage />, handle: { title: 'Maimai2.PhotosPage.Title' } },
          { path: 'dxpass', element: <Maimai2DxPassPage />, handle: { title: 'Maimai2.DxpassPage.Title' } },
          { path: 'servermissions', element: <Maimai2ServerMissionsPage />, handle: { title: 'Maimai2.ServerMissions.Title' } },
          { path: 'pointexchanges', element: <Maimai2PointExchangesPage />, handle: { title: 'Maimai2.PointExchangesPage.Title' } },
          { path: 'circle', element: <Maimai2CirclePage />, handle: { title: 'Maimai2.CirclePage.Title' } },
          { path: 'festa', element: <Maimai2FestaPage />, handle: { title: 'Maimai2.FestaPage.Title' } },
          { path: 'songlist', element: <Maimai2SongListPage />, handle: { title: 'Maimai2.SongList.Title' } },
          { path: 'rival', element: <Maimai2RivalPage />, handle: { title: 'Maimai2.RivalPage.Title' } },
          // LCDX 机台管理（等价旧版 maimai2.routing：cabinets/cabmode/remotecontrol → ManageGuard，locks → AdminGuard）
          {
            path: 'cabinets',
            element: (
              <RequireCabinetManage>
                <Maimai2CabinetsPage />
              </RequireCabinetManage>
            ),
            handle: { title: 'Maimai2.CabinetsPage.Title' },
          },
          {
            path: 'remotecontrol',
            element: (
              <RequireCabinetManage>
                <Maimai2RemoteControlPage />
              </RequireCabinetManage>
            ),
            handle: { title: 'Maimai2.RemoteControlPage.Title' },
          },
          { path: 'kop', element: <Maimai2KopRankingPage />, handle: { title: 'Maimai2.KopPage.Title' } },
          {
            path: 'cabmode',
            element: (
              <RequireCabinetManage>
                <Maimai2CabmodePage />
              </RequireCabinetManage>
            ),
            handle: { title: 'Maimai2.CabinetControlPage.Title' },
          },
          {
            path: 'locks',
            element: (
              <RequireCabinetAdmin>
                <Maimai2LocksPage />
              </RequireCabinetAdmin>
            ),
            handle: { title: 'Maimai2.LocksPage.Title' },
          },
        ],
      },

      // chunithm v2
      {
        path: '/chuni/v2',
        element: auth(<Outlet />),
        handle: { title: 'Common.ChuniV2' },
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <ChuniV2ProfilePage />, handle: { title: 'ChuniV2.ProfilePage.Title' } },
          { path: 'rating', element: <ChuniV2RatingPage />, handle: { title: 'ChuniV2.RatingPage.Title' } },
          { path: 'recent', element: <ChuniV2RecentPage />, handle: { title: 'ChuniV2.RecentPage.Title' } },
          { path: 'song', element: <ChuniV2SongListPage />, handle: { title: 'ChuniV2.MusicListPage.Title' } },
          { path: 'song/ranking/:id/:level', element: <ChuniV2SongRankingPage />, handle: { title: 'ChuniV2.SongRankingPage.Title' } },
          { path: 'character', element: <ChuniV2CharacterPage />, handle: { title: 'ChuniV2.CharacterPage.Title' } },
          { path: 'rival', element: <ChuniV2RivalPage />, handle: { title: 'ChuniV2.RivalPage.Title' } },
          { path: 'userRanking', element: <ChuniV2UserRankingPage />, handle: { title: 'ChuniV2.UserRankingPage.Title' } },
          { path: 'setting', element: <ChuniV2SettingPage />, handle: { title: 'ChuniV2.SettingsPage.Title' } },
          { path: 'userbox', element: <ChuniV2UserBoxPage />, handle: { title: 'ChuniV2.UserBoxPage.Title' } },
        ],
      },

      { path: '/oauth-callback/:type', element: <OauthCallbackPage />, handle: { title: 'OAuthPage.Title', disableSidebar: true } },
      // LCDX 网络码绑定（等价旧版 /netcode-bind：登录后可访问，无侧栏布局）
      { path: '/netcode-bind', element: auth(<NetcodeBindPage />), handle: { title: 'NetCodeBindPage.Title', disableSidebar: true } },
      // LCDX 一次性登录（等价旧版 /onetime-sign-in：游客可访问，无侧栏布局）
      { path: '/onetime-sign-in', element: <OnetimeSignInPage />, handle: { title: 'OnetimeSignInPage.Title', disableSidebar: true } },
      { path: '/sign-in', element: <RequireGuest><SignInPage /></RequireGuest>, handle: { title: 'SignInPage.Title', disableSidebar: true } },
      { path: '/sign-up', element: <RequireGuest><SignUpPage /></RequireGuest>, handle: { title: 'SignUpPage.Title', disableSidebar: true } },
      { path: '/password-reset', element: <RequireGuest><PasswordResetPage /></RequireGuest>, handle: { title: 'ResetPasswordPage.Title', disableSidebar: true } },
      { path: '/banned', element: <BannedPage />, handle: { title: 'BannedPage.Title', disableSidebar: true } },
      { path: '/admin', element: <RequireAdmin><AdminPage /></RequireAdmin>, handle: { title: 'AdminPage.Title' } },
      { path: '/not-found', element: <NotFoundPage />, handle: { title: 'NotFound.Title', disableSidebar: true } },
      { path: '*', element: <Navigate to="/not-found" replace /> },
    ],
  },
]);
