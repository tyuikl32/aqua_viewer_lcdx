# Design — route document title localization

## Approach

Turn `RouteHandle.title` into an **i18n key** and translate it at the single place where
`document.title` is written (`BootEffects`). No new dependency, no new state:
`react-i18next`'s `useTranslation()` already re-renders on `languageChanged`, so binding the
effect to `i18n.language` gives R4 for free.

### 1. `src/components/shell/AppShell.tsx`

```tsx
function BootEffects() {
  const routerNavigate = useNavigate();
  const matches = useMatches() as Array<{ handle?: { title?: string } }>;
  const { t, i18n } = useTranslation();           // <-- new

  useEffect(() => { setNavigator(routerNavigate); }, [routerNavigate]);

  useEffect(() => {
    const titles = matches
      .map((m) => m.handle?.title)
      .filter((key): key is string => Boolean(key))
      .map((key) => t(key))                        // <-- translate, not pass through
      .reverse();
    if (titles.length > 0) {
      document.title = titles.join(' - ') + ' | NET';
    }
  }, [matches, t, i18n.language]);                 // <-- language must be a dependency

  return null;
}
```

Notes:
- `t` from `useTranslation()` is already reactive; `i18n.language` is listed explicitly so the
  effect cannot be memoized past a language switch (and so `react-hooks/exhaustive-deps` is happy).
- Keep the `child - parent | NET` shape and the trailing `| NET` brand suffix unchanged (R3/R6).
- `RouteHandle.title?: string` keeps its type; update its doc comment to say it holds an i18n key.

### 2. `src/router.tsx` — replace every `handle.title` value with the mapped key

Mapping rule (R2): **use the exact key the page itself renders as its heading**, so the tab text
equals the page label. Game segment (`Mai2`/`ChuniV2`/`Ongeki`) → `Common.*`.

| Route | Old token | New i18n key | zh |
|---|---|---|---|
| `/` | `Home` | `HomePage.Title` | 主页 |
| `/profile` | `Profile` | `ProfilePage.Title` | 档案 |
| `/cards` | `Cards` | `CardsPage.Title` | 卡包 |
| `/keychip` | `Keychip` | `KeychipPage.Title` | 机台 |
| `/dashboard` | `Dashboard` | `DashboardPage.Title` | 仪表板 |
| `/import` | `Import` | `ImportPage.Title` | 导入 |
| `/announcements` | `Announcements` | `AnnouncementsPage.Title` | 公告 |
| `/announcements/edit` | `EditAnnouncements` | `AnnouncementsPage.DraftNew` | 撰写公告 |
| `/contributors` | `Contributors` | `ContributorsPage.Title` | 贡献者 |
| `/ongeki` | `Ongeki` | `Common.Ongeki` | 音击 |
| `/ongeki/profile` | `Profile` | `Ongeki.ProfilePage.Title` | 档案 |
| `/ongeki/recent` | `PlayRecord` | `Ongeki.RecentPage.Title` | 游玩记录 |
| `/ongeki/song` | `MusicList` | `Ongeki.MusicList.Title` | 乐曲列表 |
| `/ongeki/battle` | `BattlePoint` | `Ongeki.BattlePointPage.Title` | 战斗点数 |
| `/ongeki/rating` | `Rating` | `Ongeki.RatingPage.Title` | 评级 |
| `/ongeki/card/gallery` | `CardGallery` | `Ongeki.CardGallery.Title` | 卡片一览 |
| `/ongeki/card` | `Card` | `Ongeki.Card.Title` | 卡片 |
| `/ongeki/rival` | `Rival` | `Ongeki.RivalPage.Title` | 好友 |
| `/ongeki/musicRanking` | `MusicRanking` | `Ongeki.MusicRankingPage.Title` | 乐曲排行 |
| `/ongeki/userRanking` | `UserRanking` | `Ongeki.UserRankingPage.Title` | 玩家排行 |
| `/ongeki/settings` | `Setting` | `Ongeki.SettingsPage.Title` | 设定 |
| `/mai2` | `Mai2` | `Common.Mai2` | 舞萌DX |
| `/mai2/profile` | `Profile` | `Maimai2.ProfilePage.Title` | 档案 |
| `/mai2/setting` | `Setting` | `Maimai2.Setting.Title` | 设定 |
| `/mai2/recent` | `PlayRecord` | `Maimai2.RecentPage.Title` | 游玩记录 |
| `/mai2/rating` | `Rating` | `Maimai2.RatingPage.Title` | 评级 |
| `/mai2/photos` | `Photos` | `Maimai2.PhotosPage.Title` | 相册 |
| `/mai2/dxpass` | `Dxpass` | `Maimai2.DxpassPage.Title` | DX通行证 |
| `/mai2/servermissions` | `ServerMissions` | `Maimai2.ServerMissions.Title` | 服务器任务 |
| `/mai2/pointexchanges` | `PointExchanges` | `Maimai2.PointExchangesPage.Title` **(new)** | 任务点数兑换 |
| `/mai2/circle` | `Circle` | `Maimai2.CirclePage.Title` | Circle圈子 |
| `/mai2/festa` | `Festa` | `Maimai2.FestaPage.Title` | Festa活动 |
| `/mai2/songlist` | `MusicList` | `Maimai2.SongList.Title` | 歌曲列表 |
| `/mai2/rival` | `Rival` | `Maimai2.RivalPage.Title` | 对手列表 |
| `/mai2/cabinets` | `Cabinets` | `Maimai2.CabinetsPage.Title` | 机台管理 |
| `/mai2/remotecontrol` | `RemoteControl` | `Maimai2.RemoteControlPage.Title` | 远程控制 |
| `/mai2/kop` | `KOP` | `Maimai2.KopPage.Title` **(new)** | KOP 6th |
| `/mai2/cabmode` | `CabinetControl` | `Maimai2.CabinetControlPage.Title` | 机台控制 |
| `/mai2/locks` | `Locks` | `Maimai2.LocksPage.Title` | 操作记录与授权 |
| `/chuni/v2` | `ChuniV2` | `Common.ChuniV2` | 中二节奏NEW |
| `/chuni/v2/profile` | `Profile` | `ChuniV2.ProfilePage.Title` | 档案 |
| `/chuni/v2/rating` | `Rating` | `ChuniV2.RatingPage.Title` | 评级 |
| `/chuni/v2/recent` | `PlayRecord` | `ChuniV2.RecentPage.Title` | 游玩记录 |
| `/chuni/v2/song` | `MusicList` | `ChuniV2.MusicListPage.Title` | 乐曲列表 |
| `/chuni/v2/song/ranking/:id/:level` | `SongRanking` | `ChuniV2.SongRankingPage.Title` **(new)** | 乐曲排行 |
| `/chuni/v2/character` | `Character` | `ChuniV2.CharacterPage.Title` | 伙伴 |
| `/chuni/v2/rival` | `Rival` | `ChuniV2.RivalPage.Title` | 好友 |
| `/chuni/v2/userRanking` | `UserRanking` | `ChuniV2.UserRankingPage.Title` | 玩家排行 |
| `/chuni/v2/setting` | `Setting` | `ChuniV2.SettingsPage.Title` | 设定 |
| `/chuni/v2/userbox` | `UserBox` | `ChuniV2.UserBoxPage.Title` | 收藏品 |
| `/oauth-callback/:type` | `OAuthCallback` | `OAuthPage.Title` **(new)** | OAuth 登录 |
| `/netcode-bind` | `NetCodeBind` | `NetCodeBindPage.Title` | 绑定游戏档案 |
| `/onetime-sign-in` | `OneTimeSignIn` | `OnetimeSignInPage.Title` **(new)** | 一次性登录 |
| `/sign-in` | `SignIn` | `SignInPage.Title` | 登录 |
| `/sign-up` | `SignUp` | `SignUpPage.Title` | 注册账号或重设密码 |
| `/password-reset` | `ResetPassword` | `ResetPasswordPage.Title` | 重设密码 |
| `/banned` | `Account Banned` | `BannedPage.Title` | 你被封禁了 |
| `/admin` | `Admin` | `AdminPage.Title` | 管理员 |
| `/not-found` | `NotFound` | `NotFound.Title` | 页面未找到 |

Every non-**(new)** key was verified to exist in `src/i18n/zh.json` **and** `src/i18n/en.json`
(1205 keys each, mirrored in `public/assets/i18n/`).

### 3. New i18n keys (5) — add to all four files

| Key | zh | en |
|---|---|---|
| `OnetimeSignInPage.Title` | 一次性登录 | One-time Sign In |
| `OAuthPage.Title` | OAuth 登录 | OAuth Sign In |
| `Maimai2.PointExchangesPage.Title` | 任务点数兑换 | Mission Point Exchange |
| `Maimai2.KopPage.Title` | KOP 6th | KOP 6th |
| `ChuniV2.SongRankingPage.Title` | 乐曲排行 | Song Ranking |

Placement rules:
- `Maimai2.PointExchangesPage.Title` goes inside the **existing** `Maimai2.PointExchangesPage`
  object (which already holds `PageTitle` = `任务点数兑换 - 舞萌DX` — that one is the in-page `h4`
  and already contains the game suffix; do **not** reuse it as a route child title, otherwise the
  result would read `任务点数兑换 - 舞萌DX - 舞萌DX | NET`).
- `Maimai2.KopPage.Title` goes inside the existing `Maimai2.KopPage` object
  (currently `Date/Name/NoRanking/Rank/Score`).
- `ChuniV2.SongRankingPage.Title` creates a new `ChuniV2.SongRankingPage` object.
- `OnetimeSignInPage.Title` goes inside the existing `OnetimeSignInPage` object
  (currently `Loading/OperationFailed`).
- `OAuthPage.Title` goes inside the existing `OAuthPage` object.
- Keep the JSON key order alphabetical inside each object (matches the current file style).
- **All four files must receive the same five keys**: `src/i18n/zh.json`, `src/i18n/en.json`,
  `public/assets/i18n/zh.json`, `public/assets/i18n/en.json`. Verify with a flat-key diff.

## Known follow-ups (not in this task)

- `src/features/mai2/Maimai2KopRankingPage.tsx:53` renders a hardcoded `<h1 className="page-heading">KOP 6th</h1>`
  instead of `t('Maimai2.KopPage.Title')`. After this task the key exists, so that one-line cleanup
  becomes trivial — flagged for a later hardcoded-copy sweep item.
- i18n namespace naming is inconsistent across games (`Maimai2.Setting` vs `ChuniV2.SettingsPage` vs
  `Ongeki.MusicList`). This task only consumes them.

## Risk

Low. Only `document.title` output changes. Route paths, guards, page bodies and the `| NET` suffix
are untouched. Failure mode is a raw key leaking into the tab title — caught by the acceptance audit
in implement.md.
