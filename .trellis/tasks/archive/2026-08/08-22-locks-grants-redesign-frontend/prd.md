# Locks page grants redesign frontend (permission tier system)

## Goal

Frontend (locks page, `Maimai2LocksComponent`) redesign matching the shipped backend commits `8300d19` + `1623b48` (permission tier system). Authoritative plan: `e:\ALL.Net\Project_LCDX_NET\.trae\documents\locks-page-grant-redesign.md` (sections 用户决策记录 #2/#9, F1/F2/F3).

## Permission tier system (MUST be written as a code comment in bot-permission.service.ts at the constants definition, mirroring backend LCDXNetApi/Services/PermissionLevels.cs)

```
Permission tiers (LCDXMemberPermissions.Permission):
  0     无任何权限
  1-3   预留，目前无权限
  4-6   可用"机台管理授权"（新增授权；吊销仅限自己授出的行）
  7-9   可用"Admin 授权"（授权等级仅能 ≤ 自身；不可操作 Permission=10 的成员）；其余机台操作可用；主要为预留
  10    超级管理员，所有操作都可以
Rules: can only grant others <= own level; Permission<7 has NO permission-management capability
```

## Backend API contract (live)

- `GET lcdx/cabinet/grants/{userName}` — P≥7: ALL rows; P4-6: only rows GrantedBy==caller; P<4: empty. `GrantItem` includes `nickName` (string|null).
- `POST lcdx/cabinet/grants` body {userName, targetQQNumber, nickName} — P≥4.
- `DELETE lcdx/cabinet/grants` body {userName, targetQQNumber, nickName} — P10 any row; P≥4 only own granted rows (GrantedBy==caller). 94001/94041 on failure.
- `POST lcdx/cabinet/permissions` body {userName, targetQQNumber, permission, note?} — P≥7; permission ∈ [0, caller.Permission]; cannot modify member with higher permission. 94001 with message on failure.
- `GET lcdx/cabinet/permissions/{userName}` — P≥7; {total, items:[{qqNumber, permission, note, addedSince}]}.
- `DELETE lcdx/cabinet/permissions` body {userName, targetQQNumber} — P≥7; cannot delete member with higher permission; 94041 missing.

## Requirements

1. **Page access**: locks page visible to permission ≥ 4 (menu visibility in menu.service.ts, `CabinetManageGuard`, and the page's own `noPermission` fallback). < 4 blocked. (Current state is admin-only — widen to ≥4.)
2. **BotPermissionService** (`src/app/bot-permission.service.ts`):
   - Add tier constants with the full tier-table doc comment (see above; keep in sync with backend PermissionLevels.cs): `PERMISSION_NONE=0, PERMISSION_MANAGE_GRANTS=4, PERMISSION_MANAGE_PERMISSIONS=7, PERMISSION_SUPER_ADMIN=10` (or similar naming consistent with existing ADMIN_PERMISSION constant — keep existing `ADMIN_PERMISSION = 10` and add the two new thresholds around it).
   - Extend state with `qqNumber: number | null` — set from the existing EP-01 permission response (`resp.data.qqNumber`, PermissionResponseDto already carries it). No new API call.
3. **Card B 机台管理授权** (rename from 授权管理; keep existing table shape QQ/机台/状态/授权时间/操作人 + inline revoke button):
   - Cabinet column: `g.nickName || g.fullKeychip`
   - NEW: QQ search input above the table — local filter on `grants` (match qqNumber by prefix or exact)
   - Revoke button visible when `permission === 10 || g.grantedBy === currentQQ`
   - Add-grant form (target QQ + cabinet select) available for P≥4 (page gate already ensures)
4. **Card C Admin 授权** (NEW; `@if (permission >= 7)`):
   - Form: target QQ (number) + level select **options 0..caller.Permission only** + note (optional text) + submit (POST permissions)
   - Member list: QQ / level / note / addedSince + per-row delete button (DELETE permissions) with confirm dialog
   - Delete button visible only when `m.permission < callerPermission` (7-9 cannot touch P10 rows)
   - Load on init (P≥7 only) and refresh after set/delete
5. **Card A actions filter**: add `perm-set`, `perm-remove` to the actions array.
6. **Types** (`model/CabinetModels.ts`): `GrantItem` += `nickName: string | null`; add `MemberPermissionItem { qqNumber: number, permission: number, note: string | null, addedSince: string }`, `MemberPermissionList { total: number, items: MemberPermissionItem[] }`.
7. **i18n**: all new copy in zh.json + en.json under `Maimai2.LocksPage.*`: GrantsCard value → "机台管理授权"/"Cabinet Management Grants", SearchQQ placeholder, PermCard "Admin 授权"/"Admin Permission", PermTargetQQ, PermLevel, PermNote, PermNotePlaceholder, SetPermission, RemovePermission, member table headers (ColPermLevel/ColNote/ColAddedSince), revoke confirm wording.
8. **No changes**: other pages, ApiService signatures (use existing getLcdx/postLcdx/deleteLcdx), auth flows, backend.

## Acceptance Criteria

- [ ] `npm run build-prod` succeeds
- [ ] P10: full grants list + QQ search + revoke any + Admin card full (levels 0-10, delete any row)
- [ ] P7-9: full grants list + QQ search + revoke only own rows + Admin card (levels 0..own, no delete on P10 rows)
- [ ] P4-6: own-granted list only + QQ search + revoke own rows + add grant; NO Admin card
- [ ] P<4: page blocked
- [ ] Tier comment present in bot-permission.service.ts
- [ ] All copy via i18n zh+en; existing maimai2-locks spec test adapted and passing

## Notes

- IDE auto-revert hazard: re-verify critical files after edits before building.
- ng test baseline: 54 pre-existing failures; compare against baseline.
- Follow AGENTS.md: NgModule architecture, standalone: false, Bootstrap components, translate keys, ApiService.getLcdx/postLcdx/deleteLcdx for /lcdx/**.
- `isAdmin` getter stays (>=10) for other usages; new checks use the tier constants directly.
