import { Injectable } from '@angular/core';
import { User } from './user.service';
import { AccountService } from './auth/account.service';
import { BotPermissionService } from './bot-permission.service';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  public menu = new Map<string, Menu[]>(
    [
      [
        'maimai2',
        [
          {
            id: 0,
            name: 'Profile',
            url: 'mai2/profile',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 2,
            name: 'Rating',
            url: 'mai2/rating',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 3,
            name: 'PlayRecord',
            url: 'mai2/recent',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 6,
            name: 'KOP',
            url: 'mai2/kop',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 4,
            name: 'Photos',
            url: 'mai2/photos',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 5,
            name: 'Dxpass',
            url: 'mai2/dxpass',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 8,
            name: 'Circle',
            url: 'mai2/circle',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 9,
            name: 'Festa',
            url: 'mai2/festa',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 10,
            name: 'ServerMissions',
            url: 'mai2/servermissions',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 7,
            name: 'Rival',
            url: 'mai2/rival',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 11,
            name: 'Cabinets',
            url: 'mai2/cabinets',
            displayCondition: DisplayCondition.AfterLogin,
            // EP-18 hasManage 门控：无任何授权且非 Admin 的登录用户不显示（设计 §8）
            requiredBotPermission: 0,
          },
          {
            id: 12,
            name: 'CabinetControl',
            url: 'mai2/cabmode',
            displayCondition: DisplayCondition.AfterLogin,
            requiredBotPermission: 0,
          },
          {
            id: 13,
            name: 'RemoteControl',
            url: 'mai2/remotecontrol',
            displayCondition: DisplayCondition.AfterLogin,
            requiredBotPermission: 0,
          },
          {
            id: 14,
            name: 'Locks',
            url: 'mai2/locks',
            displayCondition: DisplayCondition.AfterLogin,
            // 操作记录与授权：P≥4（机台管理授权；Admin 授权卡 P≥7 由页面内部再分档）
            requiredBotPermission: 4,
          },
          {
            id: 6,
            name: 'MusicList',
            url: 'mai2/songlist',
            displayCondition: DisplayCondition.Always,
          },
          {
            id: 1,
            name: 'Setting',
            url: 'mai2/setting',
            displayCondition: DisplayCondition.HasProfile,
          }
        ]
      ]
    ]
  );

  constructor(
    private accountService: AccountService,
    private botPermission: BotPermissionService
  ) { }

  public showItem(game: string, item: Menu, user: User): boolean{
    if(item.displayCondition == DisplayCondition.Always){
      return true;
    }
    else if(item.displayCondition == DisplayCondition.AfterLogin && this.accountService.currentAccountValue){
      // 机台管理菜单组：附加 EP-18/EP-01 权限门控（设计 §8）
      if (item.requiredBotPermission !== undefined && item.requiredBotPermission !== null) {
        const state = this.botPermission.currentValue;
        if (item.requiredBotPermission === 0) {
          return state.hasManage;
        }
        return state.permission >= item.requiredBotPermission;
      }
      return true;
    }
    else if(item.displayCondition == DisplayCondition.HasProfile && user?.games.includes(game)){
      return true;
    }
    else if(item.displayCondition == DisplayCondition.IsAdmin && user?.roles.some(r => r.name === 'ROLE_ADMIN')){
      return true;
    }
    else{
      return false;
    }
  }

  public showMenu(game: string, user: User): boolean{
    return this.menu.get(game).some(item => this.showItem(game, item, user))
  }
}

export class Menu {
  id: number;
  name: string;
  url: string;
  displayCondition: DisplayCondition;
  /** LCDX 机台管理门控：0=EP-18 hasManage；>0=permission 下限（locks 页为 4=MANAGE_GRANTS）；undefined=无门控 */
  requiredBotPermission?: number;
}

export enum DisplayCondition {
  Always = 1,
  AfterLogin = 2,
  HasProfile = 4,
  IsAdmin = 8
}
