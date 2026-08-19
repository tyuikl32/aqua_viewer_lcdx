import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';
import { isOk } from '../../../model/ApiResponse';
import { BotPermissionService } from '../../../bot-permission.service';
import { CabinetSummary, REMOTE_COMMANDS, RemoteCommandResult } from '../model/CabinetModels';

interface SessionEntry {
  requestId: string;
  command: string;
  status: 'pending' | 'done' | 'timeout';
  message: string | null;
  imageUrl: string | null;
}

/**
 * 页③ 远程控制（设计 §8）：EP-19 机台下拉 + 指令下拉按角色过滤（普通 game-reboot/game-switch，Admin 17 条）
 * + EP-13 发送 → EP-13R 轮询（2s×30）+ 文本 <pre> / printscr <img>（仅 Admin）+ 会话记录（内存态）。
 */
@Component({
  selector: 'app-maimai2-remote-control',
  templateUrl: './maimai2-remote-control.component.html',
  styleUrls: ['./maimai2-remote-control.component.css'],
  standalone: false
})
export class Maimai2RemoteControlComponent implements OnInit, OnDestroy {

  protected commands: { command: string; hasArg: boolean; argHintKey: string }[] = [];

  cabinets: CabinetSummary[] = [];
  selectedNick = '';

  selectedCommand = '';
  message = '';
  sending = false;

  sessions: SessionEntry[] = [];
  private pollTimer: any = null;

  private static readonly POLL_INTERVAL_MS = 2_000;
  private static readonly POLL_MAX = 30;
  private pollCounts = new Map<string, number>();

  constructor(
    private api: ApiService,
    private userService: UserService,
    private messageService: MessageService,
    private botPermission: BotPermissionService,
    private ngZone: NgZone,
    private changeDetector: ChangeDetectorRef,
  ) {
  }

  ngOnInit(): void {
    // 指令下拉按角色过滤：普通 2 条 / Admin 17 条（安全边界在后端，此处仅 UX）
    this.commands = BotPermissionService.filterCommands(this.botPermission.currentValue.permission, REMOTE_COMMANDS);
    this.loadCabinets();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  userName(): string {
    return this.userService.currentUser?.username ?? '';
  }

  get isAdmin(): boolean {
    return this.botPermission.isAdmin;
  }

  get selectedCommandDef(): { command: string; hasArg: boolean; argHintKey: string } | undefined {
    return this.commands.find(c => c.command === this.selectedCommand);
  }

  loadCabinets(): void {
    this.api.getLcdx(`lcdx/cabinet/controllable/${encodeURIComponent(this.userName())}`).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp) && Array.isArray(resp.data)) {
          this.cabinets = resp.data;
          if (this.cabinets.length > 0) {
            this.selectedNick = this.cabinets[0].nickName ?? this.cabinets[0].fullKeychip;
          }
        }
      })
    });
  }

  send(): void {
    if (!this.selectedCommand || !this.selectedNick || this.sending) {
      return;
    }
    this.sending = true;
    this.api.postLcdx('lcdx/cabinet/command',
      {userName: this.userName(), nickName: this.selectedNick, command: this.selectedCommand, message: this.message})
      .subscribe({
        next: resp => this.runInAngular(() => {
          this.sending = false;
          if (isOk(resp) && resp.data?.requestId) {
            this.sessions.unshift({
              requestId: resp.data.requestId,
              command: this.selectedCommand,
              status: 'pending',
              message: null,
              imageUrl: null,
            });
            this.pollCounts.set(resp.data.requestId, 0);
            this.startPolling();
          } else {
            this.messageService.notice(resp?.status?.message ?? 'Failed');
          }
        }),
        error: () => {
          this.runInAngular(() => {
            this.sending = false;
            this.messageService.notice('Network error');
          });
        }
      });
  }

  private startPolling(): void {
    if (this.pollTimer) {
      return; // 单一定时器轮询全部 pending 会话
    }
    this.pollTimer = setInterval(() => this.pollPending(), Maimai2RemoteControlComponent.POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private pollPending(): void {
    const pending = this.sessions.filter(s => s.status === 'pending');
    if (pending.length === 0) {
      this.stopPolling();
      return;
    }
    for (const entry of pending) {
      const count = (this.pollCounts.get(entry.requestId) ?? 0) + 1;
      this.pollCounts.set(entry.requestId, count);
      this.api.getLcdx(`lcdx/cabinet/result/${encodeURIComponent(this.userName())}/${entry.requestId}`)
        .subscribe((resp: { status?: { code?: number }; data?: RemoteCommandResult }) => this.runInAngular(() => {
          const data = resp?.data;
          if (!data) {
            return; // 94041：保持 pending 直至上限
          }
          if (data.status !== 'pending') {
            entry.status = data.status;
            entry.message = data.message;
            entry.imageUrl = data.imageUrl;
          }
        }));
      if (count >= Maimai2RemoteControlComponent.POLL_MAX) {
        // 2s×30 上限：置 timeout 停止轮询该条目
        entry.status = 'timeout';
      }
    }
  }

  private runInAngular(action: () => void): void {
    this.ngZone.run(() => {
      action();
      this.changeDetector.detectChanges();
    });
  }

  statusBadge(entry: SessionEntry): string {
    switch (entry.status) {
      case 'done':
        return 'text-bg-success';
      case 'timeout':
        return 'text-bg-danger';
      default:
        return 'text-bg-secondary';
    }
  }
}
