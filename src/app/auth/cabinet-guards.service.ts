import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {AccountService} from './account.service';
import {BotPermissionService} from '../bot-permission.service';
import {MessageService} from '../message.service';

/**
 * 机台管理路由守卫（设计 §8 验收"直访提示无权限"的实现载体）：
 * - 未登录 → 跳首页（与 AuthGuard 一致）
 * - 已登录但无对应权限 → 提示并跳仪表板；组件内的空列表提示作为探测未完成时的兜底
 * 安全边界仍在后端 L2/L3；守卫仅为 UX，不承担鉴权职责。
 */
@Injectable({
  providedIn: 'root'
})
export class CabinetManageGuard implements CanActivate {

  constructor(
    protected router: Router,
    protected accountService: AccountService,
    protected botPermission: BotPermissionService,
    protected messageService: MessageService,
  ) {
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (!this.accountService.currentAccountValue) {
      return this.router.parseUrl('/');
    }
    // 探测未完成（刚登录）时放行：组件内 EP-19 空列表提示兜底，避免闪烁跳转
    const perm = this.botPermission.currentValue;
    if (!perm.loaded) {
      return true;
    }
    if (!perm.hasManage) {
      this.noticeDenied();
      return this.router.parseUrl('/dashboard');
    }
    return true;
  }

  protected noticeDenied(): void {
    this.messageService.notice('No permission for cabinet management');
  }
}

/** 页④ 操作记录与授权（P≥10） */
@Injectable({
  providedIn: 'root'
})
export class CabinetAdminGuard extends CabinetManageGuard {

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (!this.accountService.currentAccountValue) {
      return this.router.parseUrl('/');
    }
    const perm = this.botPermission.currentValue;
    if (!perm.loaded) {
      return true;
    }
    if (perm.permission < BotPermissionService.ADMIN_PERMISSION) {
      this.noticeDenied();
      return this.router.parseUrl('/dashboard');
    }
    return true;
  }
}
