import {Injectable, NgZone} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {ApiService} from './api.service';
import {isOk} from './model/ApiResponse';

/**
 * LCDX 机台管理权限探测（设计 §8 支撑改动）：
 * EP-01 permission（LCDXMemberPermissions，经后端）+ EP-18 manage-access（hasManage 入口探测，第五轮）。
 * UserService.load 成功后触发 load()；clear() 时归零。
 */
@Injectable({
  providedIn: 'root'
})
export class BotPermissionService {

  /**
   * Permission 等级体系（LCDXMemberPermissions.Permission，写死约定，前后端一致；
   * 与后端 LCDXNetApi/Services/PermissionLevels.cs 对齐）。2026-08-23 v2 定案
   * （设计：LCDXNetApi/.trellis/tasks/archive/2026-08/08-22-permission-tiers-v2/design.md）：
   *   0     普通用户（注册/登录自动落行；持授权行 = 休眠，需 ≥1 激活）
   *   1-3   二级负责人（机台负责人二次分发，EP-16 授权自动升至 P3；不能继续分发）
   *   4-6   机台负责人（7+/10 授机台自动升至 P4；P5/P6 手动；可授/撤自己辖区内目标 P≤3 的二级授权）
   *   7-9   管理员（Admin 授权 ≤ 自身、不可操作更高成员；EP-16/17 任意机台、目标 ≤ 自身）
   *   10    超级管理员，所有操作都可以（无视机台权限）
   * 规则：只能授权别人 ≤ 自己的等级；EP-16 自动档位只升不降（4-6 授→P3，7-10 授→P4，不产生 5/6）；
   * B1：LCset 完整键 P≥4；远程指令完整仅 P=10；档内细分为远端预留，阈值只在 0/1/4/7/10
   */
  public static readonly PERMISSION_NONE = 0;
  /** ≥1：激活门槛（A2；授权行生效的最低等级） */
  public static readonly PERMISSION_ACTIVATED = 1;
  /** 二级负责人档位（4-6 授予的自动目标） */
  public static readonly PERMISSION_SECONDARY = 3;
  /** ≥4：机台负责人下限 / 机台管理授权（locks 页入口）/ LCset 完整键（B1） */
  public static readonly MANAGE_GRANTS = 4;
  /** ≥7：Admin 授权 */
  public static readonly MANAGE_PERMISSIONS = 7;
  /** =10：超级管理员 */
  public static readonly ADMIN_PERMISSION = 10;

  /** 普通用户 Remoteware 指令子集（§3.2.1；完整 17 条仅 P=10，B1） */
  public static readonly NORMAL_REMOTE_COMMANDS = ['game-reboot', 'game-switch'];

  // v2 D13（2026-08-23）：LCset 整体仅 P≥4 可用（原 P≤3 的 event 普通子集取消），无 NORMAL_LCSET_KEYS

  private stateSubject = new BehaviorSubject<LcdxPermissionState>({
    permission: 0,
    qqNumber: null,
    hasManage: false,
    loaded: false
  });
  public readonly state = this.stateSubject.asObservable();

  constructor(private api: ApiService, private ngZone: NgZone) {
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
        this.ngZone.run(() => {
          if (isOk(resp) && resp.data) {
            this.stateSubject.next({
              permission: resp.data.permission ?? 0,
              qqNumber: resp.data.qqNumber ?? null,
              hasManage: this.stateSubject.value.hasManage,
              loaded: true
            });
          }
        });
      },
      error: () => { /* 保持默认态：permission 0 */ }
    });
    this.api.getLcdx(`lcdx/cabinet/manage-access/${encodeURIComponent(userName)}`).subscribe({
      next: resp => {
        this.ngZone.run(() => {
          if (isOk(resp) && resp.data) {
            this.stateSubject.next({
              permission: this.stateSubject.value.permission,
              qqNumber: this.stateSubject.value.qqNumber,
              hasManage: !!resp.data.hasManage,
              loaded: true
            });
          }
        });
      },
      error: () => { /* 保持默认态：hasManage false */ }
    });
  }

  /** 登出/清理：归零 */
  public clear(): void {
    this.stateSubject.next({permission: 0, qqNumber: null, hasManage: false, loaded: false});
  }

  // ---------- 角色过滤纯函数（页②③下拉用；安全边界在后端 CabinetPolicy，此处仅 UX） ----------

  /** 指令下拉按角色过滤：普通用户仅 game-reboot/game-switch，Admin 全量 */
  public static filterCommands<T extends { command: string }>(permission: number, commands: T[]): T[] {
    if (permission >= BotPermissionService.ADMIN_PERMISSION) {
      return commands;
    }
    return commands.filter(c => BotPermissionService.NORMAL_REMOTE_COMMANDS.includes(c.command));
  }

  /** lcset 下拉按角色过滤：P≥4 完整 19 项，P≤3 为空（v2 D13，与后端 CabinetPolicy 一致） */
  public static filterLcsetKeys<T extends { key: string }>(permission: number, keys: T[]): T[] {
    return permission >= BotPermissionService.MANAGE_GRANTS ? keys : [];
  }

  /** 档位名（UX 标签用；功能阈值在常量，安全边界在后端）：0 普通 / 1-3 二级负责人 / 4-6 机台负责人 / 7-9 管理员 / 10 超级管理员 */
  public static roleBand(permission: number): 'Normal' | 'Secondary' | 'Manager' | 'Admin' | 'SuperAdmin' {
    if (permission >= BotPermissionService.ADMIN_PERMISSION) {
      return 'SuperAdmin';
    }
    if (permission >= BotPermissionService.MANAGE_PERMISSIONS) {
      return 'Admin';
    }
    if (permission >= BotPermissionService.MANAGE_GRANTS) {
      return 'Manager';
    }
    if (permission >= BotPermissionService.PERMISSION_ACTIVATED) {
      return 'Secondary';
    }
    return 'Normal';
  }
}

export interface LcdxPermissionState {
  permission: number;
  /** EP-01 响应携带的成员 QQ（LCDXMemberPermissions.QQNumber）；探测未完成/失败为 null */
  qqNumber: number | null;
  hasManage: boolean;
  loaded: boolean;
}
