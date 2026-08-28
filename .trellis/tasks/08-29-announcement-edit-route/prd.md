# Fix announcement edit navigation to missing route

## Goal

管理员在公告列表右键「编辑」会跳转到不存在的路由 `/announcements/edit`，被 `**` 兜底重定向到 `/not-found`。补上路由，使已声明但不可达的 `EditComponent` 恢复可用。

## 诊断结论（2026-08-29 代码核实）

- `announcements/announcements.component.ts:137`：`this.router.navigate(['/announcements/edit'], {queryParams: {id}})`，仅在 `isAdmin()`（`roles` 含 `id === 5`）时执行。
- `app-routing.module.ts` 中 announcements 只有一条 `{path: 'announcements', component: AnnouncementsComponent, ...}`，**没有 `announcements/edit`**，也没有子路由配置。因此导航落入末尾 `{path: '**', redirectTo: '/not-found'}`。
- `EditComponent` 本身是**完整可用**的实现（`announcements/edit/edit.component.ts`）：支持新建与编辑（按 `queryParams.id` 分流）、多语言 tab、`api/admin/announcement` 的 GET/POST 调用、预览弹窗。它在 `app.module.ts:71` 已 import 并声明，只是从未被路由引用 —— 纯死代码。
- 权限门禁现状：列表页用 `isAdmin()`（`roles.id === 5`）；`auth/admin-guard.service.ts` 的 `AdminGuardService` 用完全相同的判据，且失败时跳 `/dashboard`。补路由时挂上它与列表页行为一致。
- 路由 `data.title` 只用于拼浏览器标签页标题（`app.component.ts:98-118`），与 i18n 无关，按既有风格填英文即可。

## Requirements

- 在 `app-routing.module.ts` 新增路由：
  `{path: 'announcements/edit', component: EditComponent, canActivate: [AuthGuardService, AdminGuardService], data: {title: 'EditAnnouncement'}}`
- 放在 `announcements` 路由之后、`**` 兜底之前
- 使用 `AdminGuardService` 而非仅 `AuthGuardService`，与列表页 `isAdmin()` 门禁对齐，防止非管理员直访 URL
- 不改动 `EditComponent` 的业务逻辑、模板与样式
- 不改动导航调用点（`itemContext` 行为保持）

## Acceptance Criteria

- [x] `/announcements/edit` 有对应路由，不再落入 `**` → `/not-found`
- [x] 非管理员直访 `/announcements/edit` 被 `AdminGuardService` 拦回 `/dashboard`
- [x] 本任务未改动 `EditComponent` 的业务逻辑（该文件在工作区中的 5 行 diff 全部来自同父任务下的 `08-29-i18n-passthrough`，仅把 `status.message` 透传换成 i18n key，与路由无关）
- [x] `npx tsc --noEmit -p tsconfig.app.json` 通过
- [x] `npm run build-prod` 通过

## Notes

- `EditComponent` 内部有 5 处 `status.message` / error 对象裸透传（`edit.component.ts:94, 97, 102, 115, 121`），违反 i18n 规范，**由同父任务下的 `08-29-i18n-passthrough` 子任务处理**，不在本任务改动。
- 后端 `api/admin/announcement` 端点已存在，无需后端配套改动。
