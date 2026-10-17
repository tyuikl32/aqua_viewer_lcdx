# Journal - Xavior (Part 1)

> AI development session journal
> Started: 2026-08-16

---

## 2026-08-18 项目迁移 + 第五轮设计审批通过（实施就绪）

**仓库迁移**（审核通过后、正式实施前的归位操作）：
- 两仓库迁入 `E:\ALL.Net\Project_LCDX_NET\`：**LCDXNetApi 已移入**；**aqua_viewer_lcdx 被 Trae 客户端锁定根目录**，需完全退出 Trae 后在系统终端执行：
  `Move-Item 'E:\ALL.Net\aqua_viewer_lcdx' 'E:\ALL.Net\Project_LCDX_NET'`
- 9 个文档中的旧绝对路径引用已批量替换为新路径（两仓库 .trellis/.trae 下 .md/.jsonl）
- Trae 跨会话记忆按项目路径建档：新路径打开后是全新记忆空间，**上下文锚点以仓库内文档为准**（本 journal + `.trae/documents/mai2-cabinet-management-v3-design.md` + 两侧 .trellis/tasks）

**项目状态**：
- 设计第五轮已审批通过：EP-18（manage-access 入口探测，hasManage=∃Enabled授权∨P10）/ EP-19（controllable 可操控清单，统一下拉数据源）；L2=授权行∨P10（Admin 隐式超集）；EP-02/03 废弃
- `.trae/documents/export/` 已刷新为第五轮包（8 文件）
- 下一步：正式实施——后端 13 步（`LCDXNetApi/.trellis/tasks/08-17-mai2-cabinet-backend/implement.md`）、前端 11 步（本仓库 `.trellis/tasks/08-16-mai2-cabinet-features/implement.md`）；新代码必须带单元测试（xUnit/Karma）
- 开工前待确认项见主设计文档 §11 Open questions（6 项，含 Bootstrap 管理员 QQ 号）

---




## Session 1: 机台管理实施完成 + 逐功能提交纪律落地

**Date**: 2026-08-18
**Task**: 机台管理实施完成 + 逐功能提交纪律落地
**Branch**: `master`

### Summary

前端路由守卫/spec经验沉淀/任务簿记三单元逐个审计后单独提交；双仓库clean；联调验收待后端部署

### Main Changes

- 路由守卫 CabinetManageGuard/CabinetAdminGuard（§8 直访防护，单测 6/6，ec2e420）
- spec 经验沉淀 quality-guidelines.md（IDE 还原风险/DELETE body/54 例存量基线/闭包 getter stub，447af2b）
- 任务 08-16 簿记（prd 本地验收 2/7，其余 5 项待联调，0c06efd）

### Git Commits

| Hash | Message |
|------|---------|
| `ec2e420` | (see git log) |
| `447af2b` | (see git log) |
| `0c06efd` | (see git log) |

### Testing

- [OK] 守卫 spec 6/6 绿；ng build 零错误（存量 Sass 警告除外）
- [OK] 后端 95/95 已绿（ab7ff69）

### Status

[OK] **Completed**

### Next Steps

- 部署后端 + cll.net 三表 DDL/Bootstrap 后联调验收 5 项
- 联调通过后 archive 两任务


## Session 2: 主页右栏全服游玩人数

**Date**: 2026-08-20
**Task**: 主页右栏全服游玩人数
**Branch**: `master`

### Summary

主页右侧栏新增全服游玩人数卡片，匿名聚合接口近15分钟去重玩家数，30秒自动刷新，含中英文文案与图标注册

### Main Changes

- home 组件新增 globalPlayers 状态与 30s 轮询，销毁时清理定时器
- 主页模板新增 aside 卡片，加载中显示占位符
- zh/en i18n 新增 GlobalPlayers 词条
- app.module 注册 bootstrap-people 图标

### Git Commits

| Hash | Message |
|------|---------|
| `c4ae972` | (see git log) |

### Testing

- [OK] npm run build-prod 通过
- [OK] git diff --check 通过

### Status

[OK] **Completed**


## Session 3: CiRCLE PLUS 机台模式调整

**Date**: 2026-08-20
**Task**: CiRCLE PLUS 机台模式调整
**Branch**: `master`

### Summary

机台控制前端仅显示模式4和5，两个选项均显示CiRCLE PLUS

### Main Changes

- LC_MODES 从0/4/10调整为4/5
- 中英文 Mode5 文案新增为 CiRCLE PLUS，移除旧 Mode0/Mode10 文案

### Git Commits

| Hash | Message |
|------|---------|
| `26b6acc` | (see git log) |

### Testing

- [OK] npm run build-prod 通过
- [OK] git diff --check 通过

### Status

[OK] **Completed**

## Session 4: restore cabinet modes 0/4/10 and add mode 5

**Date**: 2026-08-20
**Task**: restore cabinet modes 0/4/10 and add mode 5
**Branch**: `master`

### Summary

Restored LC_MODES to 0/4/5/10 with zh/en Mode0/Mode10 translations; fixed earlier regression that dropped modes 0 and 10.

### Git Commits

| Hash | Message |
|------|---------|
| `28c9905` | (see git log) |

### Status

[OK] **Completed**

## Session 5: localize login success toast + codify i18n rule

**Date**: 2026-08-22
**Task**: replace English "login success" passthrough with i18n; record rule in spec
**Branch**: `master`

### Summary

Login flows (password, TOTP, one-time link) showed the raw English backend message `resp.status.message` ("login success"). Switched all three success branches to `TranslateService` with new key `SignInPage.LoginSuccessMessage` (zh: "登录成功" / en: "Sign in successful"). Codified the rule in `.trellis/spec/frontend/quality-guidelines.md` under "User-facing messages must be localized": toasts must never render raw `status.message`; new keys go into zh.json and en.json in the same change; ~40 legacy passthrough call sites documented as tracked debt.

### Git Commits

| Hash | Message |
|------|---------|
| `daddd7c` | fix: localize login success toast via i18n |

### Testing

- [OK] zh.json / en.json parse as valid JSON
- [OK] `npx tsc --noEmit -p tsconfig.app.json` clean

### Status

[OK] **Completed**

## Session 6: full project audit (features / registration / i18n)

**Date**: 2026-08-22
**Task**: 08-22-full-project-audit（父任务 + 三子任务）
**Branch**: `master`

### Summary

全面静态审计：功能走查 32 项（✅15/❌6/⚠️11，核心链路契约完整）；注册 403 根因定位并恢复（主站 JWT+EULA 升级后 RinnetAdminService admin token 流程缺 EULA 接受，登录链路有注册链路无——已用 admin 账号接受 EULA v1 恢复生产，代码根治待做）；mergeRegistry 卡号转换经数据库交叉验证确认算法正确非 bug（×83+4579 与历史数据一致，挂起）；i18n 修复 7 处 zh/en key 不同步至 842/842 完全同步，存量透传 40 处 + 硬编码约 62 处分类入清单。

### Main Changes

- `src/assets/i18n/en.json`：补 Sidebar.Circle/Festa/ServerMissions、FestaPage.Title、ServerMissions.Title；修 Ongeki RecentPage `"UnknownArtist "` 尾随空格坏 key
- `src/assets/i18n/zh.json`：补 CirclePage.DirectJoin（预留 key）
- 审计报告 ×4 落盘：`.trellis/tasks/08-22-full-project-audit/research/summary.md` + 三子任务 research/

### Key Findings

- P1×3：`lcdx/getBindAccessCode/{accessCode}` 匿名无鉴权（LCDXNetUserApi.cs:80）；公告编辑跳 `/announcements/edit` 路由不存在（announcements.component.ts:137）；注册链路 Rinnet 孤儿账号可永久卡死 + 验证码错误状态码 94011/34001 不匹配 + OuterPassword 明文存储（LoginRegisterService.cs）
- P2×8：7 组件无路由不可达（含 Keychip 管理页）、公告 lang 参数被后端忽略、绑卡用 cards[0] 非 defaultCard、无 AddAuthentication 全靠手工检查、CORS 不含 localhost:4200 等（详见 summary.md）
- 注册 403 复发风险：主站再更新 EULA 版本时注册将再次 403，需在 RinnetAdminService.EnsureAdminSessionAsync 补 EULA 接受

### Testing

- [OK] `npx tsc --noEmit -p tsconfig.app.json` 通过
- [OK] zh/en JSON 解析有效，flat key 集合 842/842 完全一致
- [OK] 运行时验证：注册 403 → 接受 EULA → 恢复（用户确认已修好）

### Status

[OK] **Completed**（i18n 修复待提交；走查/注册子任务审计完毕）

### Next Steps

- 提交 i18n key 同步修复（2 文件）
- 建议后续任务：bind 端点补鉴权 / 公告编辑路由 / rinnet-admin-eula 根治 / i18n 透传清理批次1


## Session 5: Locks page permission tiers frontend

**Date**: 2026-08-22
**Task**: Locks page permission tiers frontend
**Branch**: `master`

### Summary

Locks page redesign matching backend 8300d19+1623b48: permission tier system (0/4/7/10 constants with tier-table comment in bot-permission.service.ts mirroring backend PermissionLevels.cs); page access widened to P>=4 across menu/guard/component; Card B renamed 机台管理授权 with nickname column, QQ prefix search, revoke button gated to P10-or-grantor; new Card C Admin 授权 (P>=7): level select capped at own level, member list with delete limited to lower-permission rows, confirm dialogs; qqNumber stored from EP-01 response. build-prod green, locks/guards specs 18/18. i18n staged partially to exclude other tasks' keys (Circle/Festa/DirectJoin etc. left in worktree). Pending: live tier-flow acceptance after deploy.

### Git Commits

| Hash | Message |
|------|---------|
| `b4e2aa4` | (see git log) |

### Status

[OK] **Completed**


## Session 6: Trellis task audit and closure

**Date**: 2026-08-22
**Task**: Trellis task audit and closure
**Branch**: `master`

### Summary

Audited all 7 active trellis tasks (validate + deliverable/state cross-check). Committed 08-22 audit task tree dirs (0ca051d) with seed-line cleanup; verified i18n key sync 863/863 and tsc green; ticked evidenced acceptance criteria; archived completed tasks: full-project-audit tree (3 children + parent), merge-cancel, 00-bootstrap-guidelines. Kept 08-16-mai2-cabinet-features in_progress per PRD (pending backend integration test); its jsonl still warns 48KB design doc > 32KB injection cap.

### Git Commits

(No commits - planning session)

### Status

[OK] **Completed**


## Session 7: Static audit closure of mai2 cabinet frontend

**Date**: 2026-08-22
**Task**: Static audit closure of mai2 cabinet frontend
**Branch**: `master`

### Summary

Closed 08-16-mai2-cabinet-features by static audit per user confirmation: backend confirmed deployed to prod (lcdx cabinet routes 401 on unauthenticated probe — earlier 404 was wrong path without {userName}); remaining 5 acceptance items ticked with evidence annotations (contract walkthrough audit x32 green, subset Karma tests + backend subset-denied matrix tests, EP-09 write path, Remoteware printscr/TTL unit tests, 138/138 backend tests). Feature live and iterated since (mode-5 28c9905, locks tiers b4e2aa4, dual-source grants 3405f85). Task archived; no active tasks remain in either repo.

### Git Commits

(No commits - planning session)

### Status

[OK] **Completed**


## Session 8: Locks page grants card pagination

**Date**: 2026-08-22
**Task**: Locks page grants card pagination
**Branch**: `master`

### Summary

Client-side pagination for /mai2/locks Card B (机台管理授权): page-size select 10/20/100 (default 20), pagination-controls paired with paginate pipe id=grants, QQ-prefix filter and size changes reset to page 1, loadGrants clamps out-of-bounds pages. 5 new Karma tests (8/8 green), tsc clean, i18n 864/864 sync. Codified ngx-pagination 6.x pitfall in spec: bare pagination-controls without a registered paginate instance renders nothing — Card A audit table has this latent bug (follow-up needed). Implemented via trellis-implement/check sub-agent dispatch.

### Git Commits

| Hash | Message |
|------|---------|
| `307b42f` | (see git log) |

### Status

[OK] **Completed**


## Session 9: Three UI bugfixes: switch, column shift, merge cancel toast

**Date**: 2026-08-22
**Task**: Three UI bugfixes: switch, column shift, merge cancel toast
**Branch**: `master`

### Summary

Fixed /mai2/cabinets auto-refresh switch misalignment (col-md-auto and form-check were merged on one element; BS5 float/negative-margin layout breaks in a grid column — now a proper form-check container inside the column), /mai2/remotecontrol columns sinking after command select (row align-items-end -> align-items-start so the arg-hint no longer pushes other columns down), and /mai2/setting cancel-merge raw 404 error toast (error callback now shows localized MergeCancelFailed). Both layout fixes verified via static bootstrap-5.2.3 repro page (before/after screenshots). Root cause of the 404: deployed backend predates 08-22 commits (EP-20 permissions also 404) — cancel endpoint e9efa48 and lastSuccessDate API both exist in repo and await redeploy; last-success date display already implemented (hidden while DB value is default 0001-01-01). tsc clean, setting spec 1/1.

### Git Commits

| Hash | Message |
|------|---------|
| `b2fb9dc` | (see git log) |

### Status

[OK] **Completed**


## Session 10: Fix locks audit card pagination controls

**Date**: 2026-08-22
**Task**: Fix locks audit card pagination controls
**Branch**: `master`

### Summary

Card A (操作记录) pagination-controls shipped bare with no paired paginate instance, so under ngx-pagination 6.x it silently rendered nothing — users could never page the audit table. Applied the id+pipe pairing proven on Card B, in server mode: @for pipes the EP-14 slice with {id:'locks', itemsPerPage: pageSize, currentPage: page, totalItems: total} so the pipe passes the slice through while registering control state; controls got id=locks. Removed the non-existent [rotate] input from both cards and updated the spec rule (offender note -> fixed record). New Karma test verifies server-mode rendering (total=100/size=20 -> 5 pages, anchors 'page 2'..'page 5', click -> page=3). tsc clean, 9/9 green. Debug note: anchor text carries a screen-reader 'page ' prefix, so locators must match suffix not equality.

### Git Commits

| Hash | Message |
|------|---------|
| `4380d32` | (see git log) |

### Status

[OK] **Completed**


## Session 11: Align merge date labels

**Date**: 2026-08-22
**Task**: Align merge date labels
**Branch**: `master`

### Summary

zh MergeLastSuccessDate 上次成功的日期 -> 上次成功引继的日期 (9 chars, matches 上次请求引继的日期) so the two date lines on /mai2/setting align; value-only change, key sets verified 864/864.

### Git Commits

(No commits - planning session)

### Status

[OK] **Completed**


## Session 12: cabmode restore-default + cabinets daily column + audit spec repairs

**Date**: 2026-08-24
**Task**: cabmode restore-default + cabinets daily column + audit spec repairs
**Branch**: `master`

### Summary

2026-08-24：(1) cabmode LC 设置卡 19->9 项 + 恢复默认值按钮（数字默认填入、cam 无默认禁用、cc 只读备注 格式(0,1) 且提交禁用防空值写库）（ea017a3）；(2) cabinets 人数卡新增今日列（4 列布局）（ee82e7f）；(3) 审计修复：not-found spec 用了 ngx-translate v18 已删的 TranslateModule 致 ng test 全套编译失败，改 TranslatePipe+provideTranslateService；filterLcsetKeys spec 陈旧断言（第六轮 event 子集）对齐 v2 D13 P<=3 全空（43c15cd）。ng build 零 error；ng test 自有范围用例全绿（整体 56 失败均为既有 TestBed 缺 provider，与本批改动无关）。任务已归档 08-24-lcset-restore-default / 08-24-cabinets-daily-window / 08-24-spec-repairs / 08-24-404-redesign（补档）。后端配套见 LCDXNetApi 仓。

### Git Commits

| Hash | Message |
|------|---------|
| `43c15cd` | (see git log) |

### Status

[OK] **Completed**


## Session 13: Announcement edit route + full i18n cleanup

**Date**: 2026-08-29
**Task**: 08-29-fe-route-i18n-cleanup（父 + 三子任务）
**Branch**: `master`

### Summary

补上缺失的 `/announcements/edit` 路由（AdminGuard 门禁），并把全站用户可见提示收敛到 i18n：实测 265 处违规（远超 08-22 审计估算的 100 处），分布在 40+ 文件，已全部清理，zh/en key 982/982 同步。

### Main Changes

- `app-routing.module.ts`：新增 `announcements/edit` 路由，挂 `AuthGuardService + AdminGuardService`，与列表页 `isAdmin()`（roles.id===5）门禁一致
- `message.service.ts`：注入 `TranslateService`，新增 `noticeTranslated(key, color?, params?)` 与 `noticeError(color?)`——调用点无需各自注入 TranslateService 即可本地化，这是 265 处改造能落地的关键
- 123 处 HTTP 错误对象透传 → `noticeError()`（`Common.OperationFailed`）
- 31 处 `status.message` 透传 + 106 处硬编码（英/中）→ `noticeTranslated(key)`；带插值文案用 ngx-translate 参数（`{{id}}`/`{{text}}`/`{{name}}`）
- 5 处模板 `placeholder` → `{{'Key' | translate}}`
- zh/en 同步新增 92 个 key，新建命名空间 13 个（AdminPage / OAuthPage / ImporterPage / Ongeki.RivalListPage 等）
- `keychip.component.ts` 作为样板先行改造，其私有 `noticeTranslated` 改为转发到 MessageService
- 后端配套见 LCDXNetApi 仓 c45c160 / a58ef1e

### Git Commits

| Hash | Message |
|------|---------|
| `269b030` | feat(announcements): add missing /announcements/edit route |
| `d2fbc86` | refactor(i18n): localize every user-facing message (265 sites) |

### Testing

- [OK] 自有扫描脚本复核 `TOTAL VIOLATIONS: 0 across 0 files`
- [OK] `npx tsc --noEmit -p tsconfig.app.json` 通过
- [OK] `ng build --configuration=production` 通过（2 个存量警告：bundle 超预算、qrcode CommonJS）
- [OK] zh.json / en.json 982/982 flat key 集合完全一致，无空白 key

### Status

[OK] **Completed**

### Next Steps

- **发布需前后端同步**：后端 `getBindAccessCode` 路由签名已变，前端与后端必须同版本上线，否则设置页绑卡查询 404
- 残留风险：已登录用户仍可查询他人卡号绑定关系（从匿名可查降级为登录可查），彻底修复需仓储层所有权校验
- 少量 `OperationFailed` 兜底文案语义偏通用，后续可按页面替换为专属 key


## Session 13: cabmode cabinet list locationName

**Date**: 2026-09-17
**Task**: cabmode cabinet list locationName
**Branch**: `master`

### Summary

Cabmode cabinet select now shows nickName (locationName) matching /mai2/cabinets; ngValue contract unchanged; tsc green; pushed to origin/master.

### Git Commits

| Hash | Message |
|------|---------|
| `2c38fee` | (see git log) |

### Status

[OK] **Completed**


## Session 14: remote/locks cabinet locationName no-stretch

**Date**: 2026-09-17
**Task**: remote/locks cabinet locationName no-stretch
**Branch**: `master`

### Summary

Remotecontrol and locks cabinet selects now show nickName (locationName); shared cabinet-select CSS prevents option text from stretching the control or grid column; cabmode hardened the same way; quality-guidelines updated; tsc green; locks pagination 3 failures pre-existing; pushed.

### Git Commits

| Hash | Message |
|------|---------|
| `476884a` | (see git log) |

### Status

[OK] **Completed**


## Session 15: upstream React rewrite — LCDX feature port (Phases 0–3)

**Date**: 2026-09-24 / 09-25
**Task**: react-upstream-merge (`.trellis/tasks/09-24-react-upstream-merge`)
**Branch**: `migrate/react-port` (from `backup` = upstream main mirror; `legacy-angular` keeps old Angular master; **not pushed**)

### Summary

Upstream RinNET_frontend rewrote the whole portal from Angular 16 to **React 19 + Vite 8 + TS 7 + Tailwind v4 + shadcn/ui + i18next** (690 files, +56.8k/−43.3k). A git merge is impossible (no common file language), so the strategy is **intent-level port onto the upstream baseline**:

- **Phase 0** — `legacy-angular` safety branch, `migrate/react-port` from `backup`, `.trellis` restored, `npm ci` + build green.
- **Phase 1** — i18n merged to **993 keys** zh/en-synced in BOTH `src/i18n/` and `public/assets/i18n/` (master values won all 6 conflicts — QQ-login/4-digit-code semantics); fixed upstream dead `Ongeki.RecentPage.UnknownArtist` key; LCDX API client (`lcdx.get/post/delete` on the shared auth pipeline); `botPermission.ts` five-tier model wired into `user.ts`.
- **Phase 2** — all four cabinet pages ported: **cabinets / cabmode / remote-control / locks** (+ `cabinet-models.ts`), with `RequireCabinetManage`/`RequireCabinetAdmin` guards and `Menu.requiredBotPermission` gating.
- **Phase 3** — **setting** page spliced (LCDX bind-card + 国服数据引继 merge block; portrait upload kept disabled), **netcode-bind**, **onetime-sign-in** (+ `loginLcdxOnetime`, shared `procLoginResp` gains the no-card → `/netcode-bind` branch), **kop-ranking**.

Key convention: upstream keeps **Bootstrap class names** (`globals.css` rebuilds `--bs-*`), so LCDX Angular templates translate nearly 1:1 into JSX — do not rewrite them into shadcn/Tailwind.

### Git Commits (14 ahead of `backup`, unpushed)

| Hash | Message |
|------|---------|
| `e1d92ae` | restore .trellis onto React baseline |
| `221ebb6` | i18n merge (993 keys) + env scaffolding + task docs |
| `0968738` | LCDX API client + botPermission + mai asset host + laochan.svg |
| `2c06ff2` `2ed986d` `7bda5be` `e0db341` | cabinets / remote-control / locks / cabmode |
| `cfe5b9e` `38f8c00` `d825a98` `d4b0ab9` | setting 引继 / netcode-bind / onetime-sign-in / kop |

### Testing

`npm run build` (tsc -b && vite build) green after every commit. Known non-blocking: vite-plugin-pwa `closeBundle` → `MODULE_NOT_FOUND: @rollup/plugin-babel`, so `dist/sw.js` is missing (manifest emitted). **No browser/runtime verification yet** — needs cert + hosts + dev backend.

### Status

[WIP] Phases 0–3 complete; **Phase 4 (shared-page replay, ~14 files incl. dashboard + sign-up) and Phase 5 (Liquefy default, spec rewrite, `master reset --hard`) remain**. Full handoff in `implement.md` → HANDOFF NOTES.


## Session 15: React LCDX audit SPA fallback verification

**Date**: 2026-09-25
**Task**: React LCDX audit SPA fallback verification
**Branch**: `migrate/react-port`

### Summary

Completed the follow-up for unauthenticated deep links: local React routing already sends known protected routes to home and unknown routes to the 404 page; fixed separate Baota/Nginx SPA rewrite includes for both LCDX hosts, rebuilt dist, and verified live browser behavior. No Git commit, push, or app artifact upload.

### Main Changes

- Confirmed 56 offline LCDX regression tests, including /mai2/photos -> / and unknown -> /not-found.
- Backed up and updated both site-specific Nginx rewrite files; nginx -t passed and systemctl reload nginx completed.
- Rebuilt E:\\ALL.Net\\Project_LCDX_NET\\aqua_viewer_lcdx\\dist.

### Git Commits

(No commits - planning session)

### Testing

- [OK] npm run test:lcdx-regression — 56 passed.
- [OK] npm run build — passed (tsc + Vite + PWA); existing @charset/chunk-size warnings only.
- [OK] node scripts/audit-i18n.mjs — no errors.
- [OK] Live browser checks — both domains redirect known protected deep links to / and unknown paths to /not-found.

### Status

[OK] **Completed**

### Next Steps

- Await explicit Git commit/archive approval; keep remote Nginx change recorded separately from application commits.


## Session 16: Add CiRCLE+ and MAGiCAL to the maimai2 songlist version filter

**Date**: 2026-10-10
**Task**: Add CiRCLE+ and MAGiCAL to the maimai2 songlist version filter
**Branch**: `master`

### Summary

Append 'CiRCLE+' (26) and 'MAGiCAL' (27) to the VERSIONS array in Maimai2SongListPage.tsx so the two newest maimai DX versions can be filtered; array index == song.addVersion, 28 entries, labels stay non-i18n game nouns; recorded the append-never-reorder rule in the frontend spec; build green.

### Git Commits

| Hash | Message |
|------|---------|
| `d647e4c` | (see git log) |

### Status

[OK] **Completed**


## Session 17: mai2 recent DX score 框右侧偏移：排查 + 一行修复

**Date**: 2026-10-12
**Task**: mai2 recent DX score 框右侧偏移：排查 + 一行修复
**Branch**: `master`

### Summary

实测定位内层卡片无 padding 致右侧仅 4px 留白（左 8px 不对称），加 px-3 后 20/24px；补 spec 记录回归套件 teardown 挂起与 recent 页无覆盖

### Git Commits

| Hash | Message |
|------|---------|
| `ef17e55` | (see git log) |

### Status

[OK] **Completed**


## Session 18: 登录成功 toast 上窄下宽：逐像素取证 → 归属判定 → 一行修复

**Date**: 2026-10-12
**Task**: 登录成功 toast 上窄下宽：逐像素取证 → 归属判定 → 一行修复
**Branch**: `master`

### Summary

用户报「登录成功提示框上窄下宽，是不是多了个换行」。逐像素取证证明：文案四份 i18n 干净无换行、生产盒子是对称圆角矩形（非梯形），真因是 .liquefy-toast 的 min-height 4.1rem 配上库的 align-items:flex-start，把多出的 ~11.6px 全压到文字下方（1.72×）。改 min-height 为单行自然高 3.4rem 后上下留白 1.02×。并判定该 min-height 源自上游提交 90d8f11（可原样回馈上游），另核查出「已部署但没生效」是修复当时未提交所致。

### Main Changes

- liquefy.css: .liquefy-toast min-height 4.1rem → 3.4rem（= 单行内容自然高 54.4px），只动 liquefy 作用域
- 任务文档：prd + research/toast-shape-forensics（三族×两视口实测、排除清单、生产截图取证、info/success 三重颜色判定、归属判定）+ research/deploy-verification（线上仍 4.1rem 的三方对比）
- spec/frontend/quality-guidelines.md：补 min-height+flex-start 的留白陷阱、notice 语义色、生产前端域名与线上产物核验配方

### Git Commits

| Hash | Message |
|------|---------|
| `fe6bbba` | (see git log) |
| `4a86c04` | (see git log) |
| `546573b` | (see git log) |

### Testing

- [OK] .artifacts/probe-toast-variants.mjs：盒高 65.59px/留白 1.72× → 54.39px/1.02×（3 主题族 × 1440/390 对照）
- [OK] 生产 CSS 实拉复核（经 127.0.0.1:7897）：线上 index-Cxd9SGKM.css 内 min-height:4.1rem、3.4rem 出现 0 次 ⇒ 证实该次部署未含修复
- [OK] npm run build（01:46）：产物 index-B-CkFpsO.css 内含 min-height:3.4rem ⇒ 改动编译通过

### Status

[OK] **Completed**

### Next Steps

- push master 触发 CI 自动构建+部署（未执行，待用户确认），部署后用同配方复核线上 CSS 是否已是 3.4rem
- 语义待定：SignInPage.tsx:61/92、OnetimeSignInPage.tsx:32 的 notice(text) → notice(text,'success')（图标回绿色 ✓）


## Session 19: 登录成功提示语义修正（info 青绿 ⓘ → success 绿 ✓）

**Date**: 2026-10-12
**Task**: 登录成功提示语义修正（info 青绿 ⓘ → success 绿 ✓）
**Branch**: `master`

### Summary

用户拍板后一并修语义：三处 notice(...LoginSuccessMessage) 未传颜色，导致成功提示渲染成 info（青绿 ⓘ）。补 'success' 后走 text-bg-success → 绿 #52d69a + SuccessGlyph。判定依据是生产截图（图标为圆内 i、描边色相 183.6°、填充 198.2°，三者均命中 info 而非 success）。tsc -b 通过。用户选择先不 push（push 会触发 CI 自动部署）。

### Main Changes

- SignInPage.tsx:61/:92、OnetimeSignInPage.tsx:32：notice(text) → notice(text, 'success')
- prd.md 将 C 项标记为已实施；prd.md / forensics 的 i18n 行号 1436 → 1437（他处新增 key 导致漂移）

### Git Commits

| Hash | Message |
|------|---------|
| `bf8b3f2` | (see git log) |
| `d8e51b9` | (see git log) |

### Testing

- [OK] npx tsc -b：exit 0（无输出）
- [OK] 调用点复核：全仓 LoginSuccessMessage 三处均已带 'success'，无遗漏

### Status

[OK] **Completed**

### Next Steps

- push master（待用户定时）→ 触发 CI 构建+部署；部署后用 127.0.0.1:7897 代理复核线上 CSS 是否为 3.4rem、图标是否为绿色 ✓
- 可选：给 tests/lcdx-regression 的离线 fixture 造出 1 行 toast 的触发路径，把「上下留白对称」固化为常驻回归


## Session 20: 上游 RinNET_frontend recent score 框偏移：调研定案为不修改并归档

**Date**: 2026-10-12
**Task**: 上游 RinNET_frontend recent score 框偏移：调研定案为不修改并归档
**Branch**: `master`

### Summary

确证上游同源问题（代码/CSS 与 fork 逐字节相同），上游 parity 逐像素比对仅跑 legacy family 且容差 0.5%，单边改动会破坏基线；给出 A/B/C 三方案并推荐 A；决定不改上游，零改动留档

### Git Commits

| Hash | Message |
|------|---------|
| `8a4c479` | (see git log) |

### Status

[OK] **Completed**


## Session 21: 上游 liquefy toast 修法定稿（B：保留壳层行高 + 居中）与 fork 同步

**Date**: 2026-10-12
**Task**: 上游 liquefy toast 修法定稿（B：保留壳层行高 + 居中）与 fork 同步
**Branch**: `master`

### Summary

上游 RinNET_frontend 存在同源问题（liquefy 单行 toast 上16/下27.56 = 1.72×）。按要求先出方案再取授权：服主口径（parity 已退休、改动限于主题自身代码）下对比 A/B/C/F 四案，实测证伪 C（@liquefy-ui/react 1.1.0 的 .lq-alert 仍 flex-start）。用户选定 B：保留 min-height 4.1rem（= .app-navbar 壳层行高）+ 液化作用域 align-items: center，并让 fork 统一为同一实现（原 fe6bbba 的 3.4rem 撤回）。两仓各 1 处改动，均只本地提交。

### Main Changes

- 上游 RinNET_frontend：liquefy.css 的 .liquefy-toast 加 align-items: center（1 行 + 英文注释），提交 158c4d5
- fork aqua_viewer_lcdx：同款改动（min-height 回到 4.1rem + align-items: center，中文注释），提交 e8a1590
- spec/frontend/quality-guidelines.md：把'取单行自然高 3.4rem'改判为'min-height 必须与 align-items: center 成对'，并记两仓同款需保持同步
- 任务文档：新增 10-12-upstream-liquefy-toast-fit（prd + design，含门禁现状/协作约束/实施结果）；10-11-login-success-toast-shape 标记 A 被 B 取代

### Git Commits

| Hash | Message |
|------|---------|
| `ae470e2` | (see git log) |
| `7332adf` | (see git log) |
| `e8a1590` | (see git log) |

### Testing

- [OK] .artifacts/probe-toast-fit.mjs（注入两仓真实源文件）：两仓均 544×65.59px、上/下留白 21.78/21.78 = 1.00×、单行；data-theme=legacy 下 51px + 库默认 flex-start ⇒ 作用域隔离正确
- [OK] npx tsc -b：exit 0（无输出）
- [OK] 上游门禁核查：parity 已退休；theme-system.spec.ts 与 liquefy-importer-feedback.spec.ts 均无 toast 几何断言；上游 CI 只在 push next 触发 ⇒ PR 不跑测试

### Status

[OK] **Completed**

### Next Steps

- 两仓均未 push、未开 PR：上游若开 PR，基线分支是 main（注意 fork 是 master）
- 若要在上游真机复核：需 npm ci && npm run build（上游无 node_modules），待授权
- fork 侧仍待 push 才会部署（此前 8 个未推提交 + 本轮 3 个）


## Session 22: recent score 条改判为液化作用域（方案 A）：fork 实施 + 上游 PR #64

**Date**: 2026-10-12
**Task**: recent score 条改判为液化作用域（方案 A）：fork 实施 + 上游 PR #64
**Branch**: `master`

### Summary

按服主口径把跨主题 px-3 换成 [data-theme=liquefy] 作用域 CSS；探针三主题实测（液化 20/24px、legacy 回 4/8px）；改写上游 commit 描述后推送分支并开 PR #64；归档本任务

### Git Commits

| Hash | Message |
|------|---------|
| `6e82ad0` | (see git log) |

### Status

[OK] **Completed**


## Session 23: 登录成功 toast 任务收尾：线上核实为方案 B 并归档

**Date**: 2026-10-12
**Task**: 登录成功 toast 任务收尾：线上核实为方案 B 并归档
**Branch**: `master`

### Summary

按用户指示归档 10-11-login-success-toast-shape。归档前先核实线上：fork 的 origin/master 已含全部修复（CI #67/#68 为 A 形式、#69 8ee0fcd 为 B 形式，20:19 +0800 成功），线上 index-BqfK9Hmp.css 的 .liquefy-toast 块实测含 align-items:center + min-height:4.1rem、0 处 3.4rem ⇒ 方案 B 已上线，C（success 语义）亦已上线；用户确认无问题。任务文档补齐最终状态后归档到 archive/2026-10/。

### Main Changes

- 10-11-login-success-toast-shape/prd.md：修正过时的待决段（推送/部署实际已完成），验收项补齐，候选表标注 A 弃用 / B 现行
- task.py archive → archive/2026-10/10-11-login-success-toast-shape（自动提交 chore(task)）

### Git Commits

| Hash | Message |
|------|---------|
| `0c4ecde` | (see git log) |
| `2cabadc` | (see git log) |

### Testing

- [OK] 线上 CSS 实拉复核（经 127.0.0.1:7897）：index-BqfK9Hmp.css 内 liquefy-toast 块含 align-items:center 与 min-height:4.1rem；min-height:3.4rem 出现 0 次
- [OK] CI 记录：GitHub API 显示 #69（8ee0fcd）completed/success

### Status

[OK] **Completed**

### Next Steps

- 10-12-upstream-liquefy-toast-fit 仍为 planning：上游本地提交 158c4d5 未 push、未开 PR，等用户决定（基线 main）
- 可选遗留：给 tests/lcdx-regression 的离线 fixture 造 1 行 toast 触发路径，把上下留白对称固化为常驻回归


## Session 24: KOP spec 夹具修复 + dxnum 真实库验收

**Date**: 2026-10-16
**Task**: KOP spec 夹具修复 + dxnum 真实库验收
**Branch**: `master`

### Summary

修复 content-pages 7 个 KOP 测试：补 mock lcdx/kop/current + rank glob 容忍查询参数；全量回归 67/67。教训入 spec。另在后端仓提交真实库手工验收 harness（LCDX_REAL_DB=1）并实测通过。

### Git Commits

| Hash | Message |
|------|---------|
| `50c1842` | (see git log) |

### Status

[OK] **Completed**


## Session 25: dxnum 前端全量落地：菜单/守卫/页面/类型/i18n 四份/Playwright，并归档任务

**Date**: 2026-10-17
**Task**: dxnum 前端全量落地：菜单/守卫/页面/类型/i18n 四份/Playwright，并归档任务
**Branch**: `master`

### Summary

按 .artifacts/dxnum-设计方案-v3.md §3/§5 落地：menu.ts 加 allowFromPermission + 菜单 id 16；router.tsx 加 RequireDxnumAccess + /mai2/dxnum 路由；新建 Maimai2DxnumPage.tsx（查询/刷新/分页/行展开在玩名单/动态分钟文案）；cabinet-models.ts 加两类型；i18n 四份（src+public assets，zh/en）同步；fixture.ts setup() 加可选 hasManage；dxnum.spec.ts 7 用例。npm run build 过，Playwright 定向 dxnum+guards 18/18，全量回归 67/67。修 Fragment key。未 push。

### Git Commits

| Hash | Message |
|------|---------|
| `2fb2ba8` | (see git log) |
| `8faa9ee` | (see git log) |
| `3cd5b27` | (see git log) |
| `a0356ea` | (see git log) |

### Status

[OK] **Completed**


## Session 26: dxnum v4 前端：别名查询 + 绑卡门控 + netUpsert 统计卡

**Date**: 2026-10-17
**Task**: dxnum v4 前端：别名查询 + 绑卡门控 + netUpsert 统计卡
**Branch**: `master`

### Summary

menu.ts 新增 requiresBoundCard（user.cards.length>0）并删除 allowFromPermission 权限组字段；RequireDxnumAccess 同口径，未绑卡跳 /dashboard。页面改查询驱动：进入空态不请求、输入别名前缀查询/回车/刷新、结果覆盖式刷新（保留竞态守卫与分页）。结果卡对齐 netUpsert：单台给标题/LC/三窗「X 人（共Y次）」/正在上机的玩家/两小时内游玩过的玩家（含次数）/没人快去霸机；多台只给当页合计 + 每台数字，页面不出现任何玩家名。i18n 四份同步（1320 键、audit errors 0）。定向 Playwright 21 passed。

### Git Commits

| Hash | Message |
|------|---------|
| `98e49bc` | (see git log) |
| `1813194` | (see git log) |

### Status

[OK] **Completed**


## Session 27: dxnum v5 前端：位置名遮蔽 + 别名回退渲染

**Date**: 2026-10-17
**Task**: dxnum v5 前端：位置名遮蔽 + 别名回退渲染
**Branch**: `master`

### Summary

类型加 locationVisible；单台卡标题回退链落到别名、有位置权限时补别名 badge；多台卡 showLocation = items.some(locationVisible)，低权限时位置列整列不渲染，标题同样回退别名。i18n 不新增键（四份 1320）。fixture 的 dxnumResponse 增 permission 维度脱敏；新增 3 条 Playwright 用例（P3 多台无位置/无位置列、P3 单台标题回退别名、P4 位置可见）。定向 24 passed，build 与 i18n audit 全绿。

### Git Commits

| Hash | Message |
|------|---------|
| `c55672d` | (see git log) |
| `d4a290a` | (see git log) |

### Status

[OK] **Completed**


## Session 28: dxnum v6 前端：操作记录筛选项补 dxnum-query

**Date**: 2026-10-18
**Task**: dxnum v6 前端：操作记录筛选项补 dxnum-query
**Branch**: `master`

### Summary

Maimai2LocksPage 的 ACTIONS 下拉追加 dxnum-query，用户可在 /mai2/locks 直接筛出 dxnum 查询溯源行（此前只能写 SQL）。npm run build 与 i18n audit（1320×4）全绿，定向 Playwright 24 passed。

### Git Commits

| Hash | Message |
|------|---------|
| `3e95227` | (see git log) |

### Status

[OK] **Completed**


## Session 29: dxnum UI 修复：标题改用 page-heading 约定（间距 + 装饰条归位）

**Date**: 2026-10-18
**Task**: dxnum UI 修复：标题改用 page-heading 约定（间距 + 装饰条归位）
**Branch**: `master`

### Summary

用户反馈标题与查询框太挤。根因是本页用 div.page-heading 包整页 + h2.card-title（.card-title 仅 8px 下边距），导致 ::after 装饰条被排到页面底部。改为全仓约定的 h1.page-heading + Fragment。探针实测：page-heading 元素数 1、间距 24px、底部无孤立装饰条；截图存 .artifacts/dxnum-ui-{empty,single}.png。build 过、定向 Playwright 24 passed。

### Git Commits

| Hash | Message |
|------|---------|
| `pending` | (see git log) |

### Status

[OK] **Completed**
