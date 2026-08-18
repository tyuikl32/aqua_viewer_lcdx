import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';
import { StatusCode } from '../../../status-code';
import { BotPermissionService } from '../../../bot-permission.service';
import { CabinetSummary, GrantItem, GrantList, RemoteLockItem, RemoteLockList } from '../model/CabinetModels';

/**
 * 页④ 操作记录与授权（设计 §8，P≥10）：
 * 卡A 操作记录（EP-14 过滤+分页）；卡B 授权管理（EP-15 清单 / EP-16 新增 / EP-17 吊销二次确认）。
 */
@Component({
  selector: 'app-maimai2-locks',
  templateUrl: './maimai2-locks.component.html',
  styleUrls: ['./maimai2-locks.component.css'],
  standalone: false
})
export class Maimai2LocksComponent implements OnInit {

  isAdmin = false;
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

  readonly actions = ['cabmode', 'cabreboot', 'lcset', 'cablevel', 'rm', 'grant-add', 'grant-remove'];

  // ---- 卡B 授权管理 ----
  grants: GrantItem[] = [];
  cabinets: CabinetSummary[] = [];
  grantQQ: number | null = null;
  grantNick = '';

  constructor(
    private api: ApiService,
    private userService: UserService,
    private messageService: MessageService,
    private botPermission: BotPermissionService,
  ) {
  }

  ngOnInit(): void {
    this.isAdmin = this.botPermission.isAdmin;
    if (!this.isAdmin) {
      this.noPermission = true; // 直访兜底：菜单已隐藏，此处提示无权限
      return;
    }
    this.loadLocks();
    this.loadGrants();
    this.loadCabinets();
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
      next: resp => {
        if (resp?.status?.code === StatusCode.OK) {
          const data = resp.data as RemoteLockList;
          this.locks = data?.items ?? [];
          this.total = data?.total ?? 0;
        }
      }
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
      next: resp => {
        if (resp?.status?.code === StatusCode.OK) {
          const data = resp.data as GrantList;
          this.grants = data?.items ?? [];
        }
      }
    });
  }

  loadCabinets(): void {
    this.api.getLcdx(`lcdx/cabinet/controllable/${encodeURIComponent(this.userName())}`).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK && Array.isArray(resp.data)) {
          this.cabinets = resp.data;
        }
      }
    });
  }

  addGrant(): void {
    if (this.grantQQ == null || !this.grantNick) {
      return;
    }
    this.api.postLcdx('lcdx/cabinet/grants',
      {userName: this.userName(), targetQQNumber: this.grantQQ, nickName: this.grantNick}).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK) {
          this.messageService.notice('OK');
          this.grantQQ = null;
          this.grantNick = '';
          this.loadGrants();
        } else {
          this.messageService.notice(resp?.status?.message ?? 'Failed');
        }
      }
    });
  }

  removeGrant(item: GrantItem): void {
    if (!confirm(`确认吊销 ${item.qqNumber} 对 ${item.fullKeychip} 的授权？`)) {
      return;
    }
    this.api.deleteLcdx('lcdx/cabinet/grants',
      {userName: this.userName(), targetQQNumber: item.qqNumber, nickName: item.fullKeychip}).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK) {
          this.messageService.notice('OK');
          this.loadGrants();
        } else {
          this.messageService.notice(resp?.status?.message ?? 'Failed');
        }
      }
    });
  }
}
