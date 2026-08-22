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
 * 卡A 操作记录（EP-14 过滤+分页）；卡B 机台管理授权（EP-15 辖区清单 / EP-16 新增（自动档位：4-6 授→P3，7+ 授→P4）/
 * EP-17 吊销二次确认（v2 辖区制，4-6 可撤辖区内 P≤3 的行，同级保护由后端强制））；
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
  readonly MANAGE_GRANTS = BotPermissionService.MANAGE_GRANTS;
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
  grantPage = 1;
  grantPageSize = 20;
  readonly grantPageSizeOptions = [10, 20, 100];

  // ---- 卡C Admin 授权（P≥7） ----
  members: MemberPermissionItem[] = [];
  permQQ: number | null = null;
  permLevel: number | null = null;
  permNote = '';

  /** 行内备注编辑：当前编辑行的 QQ（一次一行），null = 非编辑态 */
  editingNoteQQ: number | null = null;
  editingNoteValue = '';

  /** 成员表排序：键 + 方向（默认 QQ 升序，服务端默认序） */
  memberSortKey: 'qqNumber' | 'permission' | 'note' | 'addedSince' = 'qqNumber';
  memberSortAsc = true;

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

  /** 档位名标签（i18n：Maimai2.LocksPage.Role*）：0 普通 / 1-3 二级负责人 / 4-6 机台负责人 / 7-9 管理员 / 10 超级管理员 */
  roleBandLabel(permission: number): string {
    return this.translate.instant(`Maimai2.LocksPage.Role${BotPermissionService.roleBand(permission)}`);
  }

  /** 等级下拉选项文案：`0（无任何权限）` / `3（二级用户）` / `4（机台管理员）`（格式走 i18n，中英括号差异） */
  permLevelLabel(level: number): string {
    return this.translate.instant('Maimai2.LocksPage.PermLevelOptionFormat',
      {level, band: this.roleBandLabel(level)});
  }

  /** 表头点击排序：同列切换方向，换列重置为升序 */
  setMemberSort(key: 'qqNumber' | 'permission' | 'note' | 'addedSince'): void {
    if (this.memberSortKey === key) {
      this.memberSortAsc = !this.memberSortAsc;
    } else {
      this.memberSortKey = key;
      this.memberSortAsc = true;
    }
  }

  /** 成员表渲染数据：显示层按 ≤ 自身等级过滤（后端 EP-20L 已过滤，双保险）+ 当前排序 */
  get visibleMembers(): MemberPermissionItem[] {
    const dir = this.memberSortAsc ? 1 : -1;
    return this.members
      .filter(m => m.permission <= this.permission)
      .sort((a, b) => {
        switch (this.memberSortKey) {
          case 'permission':
            return (a.permission - b.permission) * dir;
          case 'note':
            return (a.note ?? '').localeCompare(b.note ?? '') * dir;
          case 'addedSince':
            return (a.addedSince ?? '').localeCompare(b.addedSince ?? '') * dir;
          default:
            return (a.qqNumber - b.qqNumber) * dir;
        }
      });
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
          // 刷新后当前页越界（如吊销导致列表变短）时回到第 1 页
          if ((this.grantPage - 1) * this.grantPageSize >= this.filteredGrants.length) {
            this.grantPage = 1;
          }
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

  /** 卡B 客户端分页：过滤结果本地切片 */
  get pagedGrants(): GrantItem[] {
    return this.filteredGrants.slice((this.grantPage - 1) * this.grantPageSize, this.grantPage * this.grantPageSize);
  }

  grantPageChanged(newPage: number): void {
    this.grantPage = newPage;
  }

  grantPageSizeChanged(): void {
    this.grantPage = 1;
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

  /** 行内备注编辑：进入编辑态（仅可操作行：m.permission < 自身，与删除按钮一致） */
  startNoteEdit(member: MemberPermissionItem): void {
    this.editingNoteQQ = member.qqNumber;
    this.editingNoteValue = member.note ?? '';
  }

  /** 提交备注：复用 EP-20 upsert，permission 传原值（仅改 Note；后端 AddedSince 不动） */
  submitNoteEdit(member: MemberPermissionItem): void {
    this.api.postLcdx('lcdx/cabinet/permissions',
      {userName: this.userName(), targetQQNumber: member.qqNumber, permission: member.permission, note: this.editingNoteValue || null})
      .subscribe({
        next: resp => this.runInAngular(() => {
          if (isOk(resp)) {
            this.messageService.notice(this.translate.instant('Maimai2.LocksPage.OperationSuccess'));
            this.editingNoteQQ = null;
            this.editingNoteValue = '';
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
