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

export const menu = new Map<string, Menu[]>([
  [
    'ongeki',
    [
      { id: 0, name: 'Profile', url: 'ongeki/profile', displayCondition: DisplayCondition.HasProfile },
      { id: 1, name: 'BattlePoint', url: 'ongeki/battle', displayCondition: DisplayCondition.HasProfile },
      { id: 2, name: 'Rating', url: 'ongeki/rating', displayCondition: DisplayCondition.HasProfile },
      { id: 3, name: 'PlayRecord', url: 'ongeki/recent', displayCondition: DisplayCondition.HasProfile },
      { id: 4, name: 'MusicList', url: 'ongeki/song', displayCondition: DisplayCondition.Always },
      { id: 5, name: 'Card', url: 'ongeki/card', displayCondition: DisplayCondition.HasProfile },
      { id: 6, name: 'Rival', url: 'ongeki/rival', displayCondition: DisplayCondition.HasProfile },
      { id: 7, name: 'MusicRanking', url: 'ongeki/musicRanking', displayCondition: DisplayCondition.Always },
      { id: 8, name: 'UserRanking', url: 'ongeki/userRanking', displayCondition: DisplayCondition.Always },
      { id: 9, name: 'Setting', url: 'ongeki/settings', displayCondition: DisplayCondition.HasProfile },
    ],
  ],
  [
    'chusan',
    [
      { id: 0, name: 'Profile', url: 'chuni/v2/profile', displayCondition: DisplayCondition.HasProfile },
      { id: 1, name: 'Rating', url: 'chuni/v2/rating', displayCondition: DisplayCondition.HasProfile },
      { id: 2, name: 'PlayRecord', url: 'chuni/v2/recent', displayCondition: DisplayCondition.HasProfile },
      { id: 3, name: 'MusicList', url: 'chuni/v2/song', displayCondition: DisplayCondition.Always },
      { id: 4, name: 'Character', url: 'chuni/v2/character', displayCondition: DisplayCondition.HasProfile },
      { id: 5, name: 'Rival', url: 'chuni/v2/rival', displayCondition: DisplayCondition.HasProfile },
      { id: 6, name: 'UserBox', url: 'chuni/v2/userbox', displayCondition: DisplayCondition.HasProfile },
      { id: 7, name: 'UserRanking', url: 'chuni/v2/userRanking', displayCondition: DisplayCondition.Always },
      { id: 8, name: 'Setting', url: 'chuni/v2/setting', displayCondition: DisplayCondition.HasProfile },
    ],
  ],
  [
    'maimai2',
    [
      { id: 0, name: 'Profile', url: 'mai2/profile', displayCondition: DisplayCondition.HasProfile },
      { id: 2, name: 'Rating', url: 'mai2/rating', displayCondition: DisplayCondition.HasProfile },
      { id: 3, name: 'PlayRecord', url: 'mai2/recent', displayCondition: DisplayCondition.HasProfile },
      { id: 4, name: 'Photos', url: 'mai2/photos', displayCondition: DisplayCondition.HasProfile },
      { id: 5, name: 'Dxpass', url: 'mai2/dxpass', displayCondition: DisplayCondition.HasProfile },
      { id: 8, name: 'Circle', url: 'mai2/circle', displayCondition: DisplayCondition.HasProfile },
      { id: 9, name: 'Festa', url: 'mai2/festa', displayCondition: DisplayCondition.HasProfile },
      { id: 10, name: 'ServerMissions', url: 'mai2/servermissions', displayCondition: DisplayCondition.HasProfile },
      { id: 7, name: 'Rival', url: 'mai2/rival', displayCondition: DisplayCondition.HasProfile },
      // LCDX 机台管理（等价旧版 menu.service：AfterLogin + requiredBotPermission 门控）
      { id: 11, name: 'Cabinets', url: 'mai2/cabinets', displayCondition: DisplayCondition.AfterLogin, requiredBotPermission: 0 },
      { id: 13, name: 'RemoteControl', url: 'mai2/remotecontrol', displayCondition: DisplayCondition.AfterLogin, requiredBotPermission: 0 },
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
