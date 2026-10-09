import { lcdx } from '@/lib/api/client';
import { isOk } from '@/lib/models';
import { createStore, useStore } from '@/lib/store';

/**
 * LCDX 机台管理权限探测（等价旧版 bot-permission.service.ts）。
 * EP-01 permission（LCDXMemberPermissions，经后端）+ EP-18 manage-access（hasManage 入口探测）。
 * loadUser 成功后触发 load；clearUser 时归零。
 */

/**
 * Permission 等级体系（LCDXMemberPermissions.Permission，写死约定，前后端一致；
 * 与后端 LCDXNetApi/Services/PermissionLevels.cs 对齐）。2026-08-23 v2 定案：
 *   0     普通用户（注册/登录自动落行；持授权行 = 休眠，需 ≥1 激活）
 *   1-3   二级负责人（机台负责人二次分发，EP-16 授权自动升至 P3；不能继续分发）
 *   4-6   机台负责人（7+/10 授机台自动升至 P4；P5/P6 手动；可授/撤自己辖区内目标 P≤3 的二级授权）
 *   7-9   管理员（Admin 授权 ≤ 自身、不可操作更高成员；EP-16/17 任意机台、目标 ≤ 自身）
 *   10    超级管理员，所有操作都可以（无视机台权限）
 * 规则：只能授权别人 ≤ 自己的等级；EP-16 自动档位只升不降（4-6 授→P3，7-10 授→P4，不产生 5/6）；
 * B1：LCset 完整键 P≥4；远程指令完整仅 P=10；档内细分为远端预留，阈值只在 0/1/4/7/10
 */
export const PERMISSION_NONE = 0;
/** ≥1：激活门槛（A2；授权行生效的最低等级） */
export const PERMISSION_ACTIVATED = 1;
/** 二级负责人档位（4-6 授予的自动目标） */
export const PERMISSION_SECONDARY = 3;
/** ≥4：机台负责人下限 / 机台管理授权（locks 页入口）/ LCset 完整键（B1） */
export const MANAGE_GRANTS = 4;
/** ≥7：Admin 授权 */
export const MANAGE_PERMISSIONS = 7;
/** =10：超级管理员 */
export const ADMIN_PERMISSION = 10;

/** 普通用户 Remoteware 指令子集（§3.2.1；完整 17 条仅 P=10，B1） */
export const NORMAL_REMOTE_COMMANDS = ['game-reboot', 'game-switch'];

// v2 D13（2026-08-23）：LCset 整体仅 P≥4 可用（原 P≤3 的 event 普通子集取消），无普通用户键集

export interface LcdxPermissionState {
  permission: number;
  /** EP-01 响应携带的成员 QQ（LCDXMemberPermissions.QQNumber）；探测未完成/失败为 null */
  qqNumber: number | null;
  hasManage: boolean;
  loaded: boolean;
}

const INITIAL_STATE: LcdxPermissionState = {
  permission: 0,
  qqNumber: null,
  hasManage: false,
  loaded: false,
};

export const botPermissionStore = createStore<LcdxPermissionState>(INITIAL_STATE);

/** 订阅权限态（组件内使用；等价旧版 botPermission.state 订阅） */
export function useBotPermission(): LcdxPermissionState {
  return useStore(botPermissionStore);
}

export function getBotPermission(): LcdxPermissionState {
  return botPermissionStore.get();
}

export function isBotAdmin(): boolean {
  return getBotPermission().permission >= ADMIN_PERMISSION;
}

// A generation covers both probes and is invalidated on logout/account replacement.
let permissionGeneration = 0;
let permissionUser: string | null = null;

/** 登录后并行探测；两个请求均结束才完成加载，避免守卫使用半份权限快照。 */
export function loadBotPermission(userName: string): void {
  const generation = ++permissionGeneration;
  if (permissionUser !== userName) {
    botPermissionStore.set(INITIAL_STATE);
    permissionUser = userName;
  }
  if (!userName) return;

  const encoded = encodeURIComponent(userName);
  void Promise.allSettled([
    lcdx.get(`lcdx/cabinet/permission/${encoded}`),
    lcdx.get(`lcdx/cabinet/manage-access/${encoded}`),
  ]).then(([permissionResult, manageResult]) => {
    if (generation !== permissionGeneration) return;
    const permission = permissionResult.status === 'fulfilled' && isOk(permissionResult.value)
      ? permissionResult.value.data : null;
    const manage = manageResult.status === 'fulfilled' && isOk(manageResult.value)
      ? manageResult.value.data : null;
    botPermissionStore.set({
      permission: permission?.permission ?? 0,
      qqNumber: permission?.qqNumber ?? null,
      hasManage: !!manage?.hasManage,
      loaded: true,
    });
  });
}

/** 登出/清理：归零并废弃旧请求，不能让旧账号的权限写回。 */
export function clearBotPermission(): void {
  permissionGeneration++;
  permissionUser = null;
  botPermissionStore.set(INITIAL_STATE);
}

// ---------- 角色过滤纯函数（页②③下拉用；安全边界在后端 CabinetPolicy，此处仅 UX） ----------

/** 指令下拉按角色过滤：普通用户仅 game-reboot/game-switch，Admin 全量 */
export function filterCommands<T extends { command: string }>(permission: number, commands: T[]): T[] {
  if (permission >= ADMIN_PERMISSION) {
    return commands;
  }
  return commands.filter((c) => NORMAL_REMOTE_COMMANDS.includes(c.command));
}

/** lcset 下拉按角色过滤：P≥4 完整 9 项，P≤3 为空（v2 D13，与后端 CabinetPolicy 一致） */
export function filterLcsetKeys<T extends { key: string }>(permission: number, keys: T[]): T[] {
  return permission >= MANAGE_GRANTS ? keys : [];
}

/** 档位名（UX 标签用；功能阈值在常量，安全边界在后端）：0 普通 / 1-3 二级负责人 / 4-6 机台负责人 / 7-9 管理员 / 10 超级管理员 */
export function roleBand(permission: number): 'Normal' | 'Secondary' | 'Manager' | 'Admin' | 'SuperAdmin' {
  if (permission >= ADMIN_PERMISSION) {
    return 'SuperAdmin';
  }
  if (permission >= MANAGE_PERMISSIONS) {
    return 'Admin';
  }
  if (permission >= MANAGE_GRANTS) {
    return 'Manager';
  }
  if (permission >= PERMISSION_ACTIVATED) {
    return 'Secondary';
  }
  return 'Normal';
}
