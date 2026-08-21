import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';
import { isOk } from '../../../model/ApiResponse';
import { BotPermissionService } from '../../../bot-permission.service';
import { CabinetSummary, GrantItem, GrantList, MemberPermissionItem, MemberPermissionList, RemoteLockItem, RemoteLockList } from '../model/CabinetModels';

/**
 * 页④ 操作记录与授权（设计 §8，P≥4）：
 * 卡A 操作记录（EP-14 过滤+分页）；卡B 机台管理授权（EP-15 清单 / EP-16 新增 / EP-17 吊销二次确认，吊销限自己授出的行或 P=10）；
 * 卡C Admin 授权（EP-20 设置 / EP-20L 清单 / EP-20D 删除，P≥7）。
 */
@Component({
  selector: 'app-maimai2-locks',
  templateUrl: './maimai2-locks.component.html',
  styleUrls: ['./maimai2-locks.component.css'],
  standalone: false
})
export class Maimai2LocksComponent implements OnInit {

  /** 模板用阈值常量（与 BotPermissionService / 后端 PermissionLevels 对齐） */
  readonly ADMIN_PERMISSION = BotPermissionService.ADMIN_PERMISSION;
  readonly MANAGE_PERMISSIONS = BotPermissionService.MANAGE_PERMISSIONS;

  permission = 0;
  currentQQ: number | null = null;
  noPermission = false;

  // ---- 卡A 操作记录 ----
  locks: RemoteLockItem[] = [];
  total = 0;
  page = 1;
  readonly pageSize = 20;

  filterQQ: number | null = null;
  filterKeychip = '';
  filterAction = '';
  filterSince = '';
  filterUntil = '';

  readonly actions = ['cabmode', 'cabreboot', 'lcset', 'cablevel', 'rm', 'grant-add', 'grant-remove', 'perm-set', 'perm-remove'];

  // ---- 卡B 机台管理授权 ----
  grants: GrantItem[] = [];
  cabinets: CabinetSummary[] = [];
  grantQQ: number | null = null;
  grantNick = '';
  grantSearchQQ: number | null = null;

  // ---- 卡C Admin 授权（P≥7） ----
  members: MemberPermissionItem[] = [];
  permQQ: number | null = null;
  permLevel: number | null = null;
  permNote = '';

  constructor(
    private api: ApiService,
    private userService: UserService,
    private messageService: MessageService,
    private botPermission: BotPermissionService,
    private translate: TranslateService,
    private ngZone: NgZone,
    private changeDetector: ChangeDetectorRef,
  ) {
  }

  ngOnInit(): void {
    const state = this.botPermission.currentValue;
    this.permission = state.permission;
    this.currentQQ = state.qqNumber;
    if (this.permission < BotPermissionService.MANAGE_GRANTS) {
      this.noPermission = true; // 直访兜底：菜单已隐藏，此处提示无权限
      return;
    }
    this.loadLocks();
    this.loadGrants();
    this.loadCabinets();
    if (this.permission >= BotPermissionService.MANAGE_PERMISSIONS) {
      this.loadMembers();
    }
  }

  userName(): string {
    return this.userService.currentUser?.username ?? '';
  }

  // ==================== 卡A：EP-14 ====================

  loadLocks(): void {
    let params = `page=${this.page}&size=${this.pageSize}`;
    if (this.filterQQ != null) {
      params += `&targetQQ=${this.filterQQ}`;
    }
    if (this.filterKeychip) {
      params += `&fullKeychip=${encodeURIComponent(this.filterKeychip)}`;
    }
    if (this.filterAction) {
      params += `&action=${encodeURIComponent(this.filterAction)}`;
    }
    if (this.filterSince) {
      params += `&since=${encodeURIComponent(this.filterSince)}`;
    }
    if (this.filterUntil) {
      params += `&until=${encodeURIComponent(this.filterUntil)}`;
    }
    this.api.getLcdx(`lcdx/cabinet/locks/${encodeURIComponent(this.userName())}?${params}`).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          const data = resp.data as RemoteLockList;
          this.locks = data?.items ?? [];
          this.total = data?.total ?? 0;
        }
      })
    });
  }

  applyFilter(): void {
    this.page = 1;
    this.loadLocks();
  }

  pageChanged(newPage: number): void {
    this.page = newPage;
    this.loadLocks();
  }

  resultBadge(result: string): string {
    return result === 'success' ? 'text-bg-success' : 'text-bg-danger';
  }

  // ==================== 卡B：EP-15/16/17 ====================

  loadGrants(): void {
    this.api.getLcdx(`lcdx/cabinet/grants/${encodeURIComponent(this.userName())}`).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          const data = resp.data as GrantList;
          this.grants = data?.items ?? [];
        }
      })
    });
  }

  loadCabinets(): void {
    this.api.getLcdx(`lcdx/cabinet/controllable/${encodeURIComponent(this.userName())}`).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp) && Array.isArray(resp.data)) {
          this.cabinets = resp.data;
        }
      })
    });
  }

  /** QQ 搜索本地过滤：前缀匹配（含精确）；为空显示全部 */
  get filteredGrants(): GrantItem[] {
    if (this.grantSearchQQ == null) {
      return this.grants;
    }
    const prefix = String(this.grantSearchQQ);
    return this.grants.filter(g => String(g.qqNumber).startsWith(prefix));
  }

  addGrant(): void {
    if (this.grantQQ == null || !this.grantNick) {
      return;
    }
    this.api.postLcdx('lcdx/cabinet/grants',
      {userName: this.userName(), targetQQNumber: this.grantQQ, nickName: this.grantNick}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.messageService.notice('OK');
          this.grantQQ = null;
          this.grantNick = '';
          this.loadGrants();
        } else {
          this.messageService.notice(resp?.status?.message ?? 'Failed');
        }
      })
    });
  }

  removeGrant(item: GrantItem): void {
    const cabinet = item.nickName || item.fullKeychip;
    if (!confirm(this.translate.instant('Maimai2.LocksPage.RevokeConfirm', {qq: item.qqNumber, cabinet}))) {
      return;
    }
    this.api.deleteLcdx('lcdx/cabinet/grants',
      {userName: this.userName(), targetQQNumber: item.qqNumber, nickName: item.fullKeychip}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.messageService.notice('OK');
          this.loadGrants();
        } else {
          this.messageService.notice(resp?.status?.message ?? 'Failed');
        }
      })
    });
  }

  // ==================== 卡C：EP-20/20L/20D（P≥7） ====================

  /** 等级下拉选项：仅 0..自身等级（只能授权别人 ≤ 自己） */
  get permLevelOptions(): number[] {
    return Array.from({length: this.permission + 1}, (_, i) => i);
  }

  loadMembers(): void {
    this.api.getLcdx(`lcdx/cabinet/permissions/${encodeURIComponent(this.userName())}`).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          const data = resp.data as MemberPermissionList;
          this.members = data?.items ?? [];
        }
      })
    });
  }

  setPermission(): void {
    if (this.permQQ == null || this.permLevel == null) {
      return;
    }
    this.api.postLcdx('lcdx/cabinet/permissions',
      {userName: this.userName(), targetQQNumber: this.permQQ, permission: this.permLevel, note: this.permNote || null})
      .subscribe({
        next: resp => this.runInAngular(() => {
          if (isOk(resp)) {
            this.messageService.notice(this.translate.instant('Maimai2.LocksPage.OperationSuccess'));
            this.permQQ = null;
            this.permLevel = null;
            this.permNote = '';
            this.loadMembers();
          } else {
            this.messageService.notice(this.translate.instant('Maimai2.LocksPage.OperationFailed'));
          }
        })
      });
  }

  removePermission(member: MemberPermissionItem): void {
    if (!confirm(this.translate.instant('Maimai2.LocksPage.RemovePermConfirm', {qq: member.qqNumber}))) {
      return;
    }
    this.api.deleteLcdx('lcdx/cabinet/permissions',
      {userName: this.userName(), targetQQNumber: member.qqNumber}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.messageService.notice(this.translate.instant('Maimai2.LocksPage.OperationSuccess'));
          this.loadMembers();
        } else {
          this.messageService.notice(this.translate.instant('Maimai2.LocksPage.OperationFailed'));
        }
      })
    });
  }

  private runInAngular(action: () => void): void {
    this.ngZone.run(() => {
      action();
      this.changeDetector.detectChanges();
    });
  }
}
