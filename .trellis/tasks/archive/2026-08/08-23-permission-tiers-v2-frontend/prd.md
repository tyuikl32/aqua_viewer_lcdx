# Permission tiers v2 frontend (role bands + lcset tier)

## Goal

前端适配后端权限分级 v2（已上线 commit `73704c8`，决议 **A2 激活制 + B1 + D9 自动 P3 + D11 自动 P4**）。
权威设计：`LCDXNetApi/.trellis/tasks/archive/2026-08/08-22-permission-tiers-v2/design.md`。

## Requirements

1. `bot-permission.service.ts`：
   - 档位常量与注释对齐后端 `PermissionLevels`：`ACTIVATED=1`、`SECONDARY=3`、`MANAGE_GRANTS=4`、`MANAGE_PERMISSIONS=7`、`ADMIN_PERMISSION=10`；档名（0 普通 / 1-3 二级负责人 / 4-6 机台负责人 / 7-9 管理员 / 10 超级管理员）写入常量定义处注释（前后端一致约定）。
   - `filterLcsetKeys` 的完整键门槛从 `isAdmin(≥10)` 改为 `permission >= 4`（B1）；`filterCommands` 门槛维持 10。
   - 注意：A2 后端对 P0 持行者返回 `hasManage=false` / controllable 空 → 菜单/守卫逻辑无需改，自动收起。
2. locks 页（maimai2-locks）：
   - Card B「机台管理授权」：4-6 调用者视角 = 辖区（后端 EP-15 已返回辖区行）；吊销按钮可见性改为 `permission >= MANAGE_GRANTS`（后端强制辖区/同级保护，前端只做 UX 近似）。
   - Card C「Admin 授权」等级下拉（0..own）加档名标签（如 `3 · 二级负责人`、`4 · 机台负责人`）；成员列表等级列同样带档名。
   - 授权成功提示可提及自动档位（4-6 授→P3；7+ 授→P4），文案放 i18n。
3. i18n `zh.json`/`en.json`：四档角色名 + 相关文案（`Maimai2.LocksPage.*` 与 `BotPermission.*`）。
4. 不改：EP-16/17/15 请求结构与 DTO（后端已兼容）；`CabinetModels.ts` 类型无需新增字段（`permissionAfter` 仅审计用）。

## Acceptance Criteria

- [ ] `npm run build-prod` 通过；对照既有失败基线不新增失败（tsc clean）
- [ ] P4 用户登录：locks 页可见辖区授权行（含他人授出）、可发起授权（后端校验）；LCset 面板显示完整键
- [ ] P3 用户：LCset 仅 `event`；指令仅 `game-reboot/game-switch`
- [ ] P0 持行（休眠）用户：菜单自动收起（hasManage=false 路径）
- [ ] 中英文档名标签齐全

## Notes

- 后端已部署仓库但**生产未重新部署**（与 e9efa48 待部署项合并处理）；前端可与后端同批发。
- 安全边界在后端（CabinetPolicy / EP-16/17/15），前端过滤仅为 UX——沿用既有双层验证约定。
