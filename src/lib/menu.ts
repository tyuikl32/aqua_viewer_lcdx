import { getAccount } from '@/lib/auth/account';
import { getBotPermission } from '@/lib/botPermission';
import type { User } from '@/lib/models';

/** 等价旧版 menu.service.ts */

export enum DisplayCondition {
  Always = 1,
  AfterLogin = 2,
  HasProfile = 4,
  IsAdmin = 8,
}

export interface Menu {
  id: number;
  name: string;
  url: string;
  displayCondition: DisplayCondition;
  /** LCDX 机台管理门控：0=EP-18 hasManage；>0=permission 下限（locks 页为 4=MANAGE_GRANTS）；undefined=无门控 */
  requiredBotPermission?: number;
}

/**
 * 侧栏菜单分组（等价旧版 menu.service.ts）。
 * LCDX 为 mai2-only 部署：旧版已删除 ongeki/chusan 两组，这里保持一致 ——
 * 页面、路由与 i18n 文案都保留，只是不再从侧栏暴露入口。
 */
export const menu = new Map<string, Menu[]>([
  [
    'maimai2',
    [
      { id: 0, name: 'Profile', url: 'mai2/profile', displayCondition: DisplayCondition.HasProfile },
      { id: 2, name: 'Rating', url: 'mai2/rating', displayCondition: DisplayCondition.HasProfile },
      { id: 3, name: 'PlayRecord', url: 'mai2/recent', displayCondition: DisplayCondition.HasProfile },
      // 顺序与旧版一致（KOP 紧随 PlayRecord）。旧版 KOP 与 MusicList 同为 id 6，
      // React 以 id 作 key 会撞键，故这里保留 15。
      { id: 15, name: 'KOP', url: 'mai2/kop', displayCondition: DisplayCondition.HasProfile },
      { id: 4, name: 'Photos', url: 'mai2/photos', displayCondition: DisplayCondition.HasProfile },
      { id: 5, name: 'Dxpass', url: 'mai2/dxpass', displayCondition: DisplayCondition.HasProfile },
      { id: 8, name: 'Circle', url: 'mai2/circle', displayCondition: DisplayCondition.HasProfile },
      { id: 9, name: 'Festa', url: 'mai2/festa', displayCondition: DisplayCondition.HasProfile },
      { id: 10, name: 'ServerMissions', url: 'mai2/servermissions', displayCondition: DisplayCondition.HasProfile },
      { id: 7, name: 'Rival', url: 'mai2/rival', displayCondition: DisplayCondition.HasProfile },
      // LCDX 机台管理（等价旧版 menu.service：AfterLogin + requiredBotPermission 门控）
      { id: 11, name: 'Cabinets', url: 'mai2/cabinets', displayCondition: DisplayCondition.AfterLogin, requiredBotPermission: 0 },
      { id: 12, name: 'CabinetControl', url: 'mai2/cabmode', displayCondition: DisplayCondition.AfterLogin, requiredBotPermission: 0 },
      { id: 13, name: 'RemoteControl', url: 'mai2/remotecontrol', displayCondition: DisplayCondition.AfterLogin, requiredBotPermission: 0 },
      // 操作记录与授权：P≥4（机台管理授权；Admin 授权卡 P≥7 由页面内部再分档）
      { id: 14, name: 'Locks', url: 'mai2/locks', displayCondition: DisplayCondition.AfterLogin, requiredBotPermission: 4 },
      { id: 6, name: 'MusicList', url: 'mai2/songlist', displayCondition: DisplayCondition.Always },
      { id: 1, name: 'Setting', url: 'mai2/setting', displayCondition: DisplayCondition.HasProfile },
    ],
  ],
]);

export function showItem(game: string, item: Menu, user: User | null): boolean {
  if (item.displayCondition === DisplayCondition.Always) {
    return true;
  } else if (item.displayCondition === DisplayCondition.AfterLogin && getAccount()) {
    // 机台管理菜单组：附加 EP-18/EP-01 权限门控（等价旧版 menu.service.showItem）
    if (item.requiredBotPermission !== undefined && item.requiredBotPermission !== null) {
      const state = getBotPermission();
      if (item.requiredBotPermission === 0) {
        return state.hasManage;
      }
      return state.permission >= item.requiredBotPermission;
    }
    return true;
  } else if (item.displayCondition === DisplayCondition.HasProfile && user?.games?.includes(game)) {
    return true;
  } else if (item.displayCondition === DisplayCondition.IsAdmin && user?.roles?.some((r) => r.name === 'ROLE_ADMIN')) {
    return true;
  }
  return false;
}

export function showMenu(game: string, user: User | null): boolean {
  return (menu.get(game) ?? []).some((item) => showItem(game, item, user));
}
