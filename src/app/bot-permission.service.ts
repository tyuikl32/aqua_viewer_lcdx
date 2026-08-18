import {Injectable} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {ApiService} from './api.service';
import {StatusCode} from './status-code';

/**
 * LCDX 机台管理权限探测（设计 §8 支撑改动）：
 * EP-01 permission（LCDXMemberPermissions，经后端）+ EP-18 manage-access（hasManage 入口探测，第五轮）。
 * UserService.load 成功后触发 load()；clear() 时归零。
 */
@Injectable({
  providedIn: 'root'
})
export class BotPermissionService {

  public static readonly ADMIN_PERMISSION = 10;

  /** 普通用户 Remoteware 指令子集（§3.2.1；Admin 17 条全量由页面配置） */
  public static readonly NORMAL_REMOTE_COMMANDS = ['game-reboot', 'game-switch'];

  /** 普通用户 lcset 子集（第六轮 Q1 定案：仅 event，chevent 不下放） */
  public static readonly NORMAL_LCSET_KEYS = ['event'];

  private stateSubject = new BehaviorSubject<LcdxPermissionState>({
    permission: 0,
    hasManage: false,
    loaded: false
  });
  public readonly state = this.stateSubject.asObservable();

  constructor(private api: ApiService) {
  }

  public get currentValue(): LcdxPermissionState {
    return this.stateSubject.value;
  }

  public get isAdmin(): boolean {
    return this.currentValue.permission >= BotPermissionService.ADMIN_PERMISSION;
  }

  /** 登录后调用：EP-01 + EP-18 并行探测（任一失败保持默认态，不阻塞页面） */
  public load(userName: string): void {
    if (!userName) {
      return;
    }
    this.api.getLcdx(`lcdx/cabinet/permission/${encodeURIComponent(userName)}`).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK && resp.data) {
          this.stateSubject.next({
            permission: resp.data.permission ?? 0,
            hasManage: this.stateSubject.value.hasManage,
            loaded: true
          });
        }
      },
      error: () => { /* 保持默认态：permission 0 */ }
    });
    this.api.getLcdx(`lcdx/cabinet/manage-access/${encodeURIComponent(userName)}`).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK && resp.data) {
          this.stateSubject.next({
            permission: this.stateSubject.value.permission,
            hasManage: !!resp.data.hasManage,
            loaded: true
          });
        }
      },
      error: () => { /* 保持默认态：hasManage false */ }
    });
  }

  /** 登出/清理：归零 */
  public clear(): void {
    this.stateSubject.next({permission: 0, hasManage: false, loaded: false});
  }

  // ---------- 角色过滤纯函数（页②③下拉用；安全边界在后端 CabinetPolicy，此处仅 UX） ----------

  /** 指令下拉按角色过滤：普通用户仅 game-reboot/game-switch，Admin 全量 */
  public static filterCommands<T extends { command: string }>(permission: number, commands: T[]): T[] {
    if (permission >= BotPermissionService.ADMIN_PERMISSION) {
      return commands;
    }
    return commands.filter(c => BotPermissionService.NORMAL_REMOTE_COMMANDS.includes(c.command));
  }

  /** lcset 下拉按角色过滤：普通用户仅 event，Admin 全量 19 项 */
  public static filterLcsetKeys<T extends { key: string }>(permission: number, keys: T[]): T[] {
    if (permission >= BotPermissionService.ADMIN_PERMISSION) {
      return keys;
    }
    return keys.filter(k => BotPermissionService.NORMAL_LCSET_KEYS.includes(k.key));
  }
}

export interface LcdxPermissionState {
  permission: number;
  hasManage: boolean;
  loaded: boolean;
}
