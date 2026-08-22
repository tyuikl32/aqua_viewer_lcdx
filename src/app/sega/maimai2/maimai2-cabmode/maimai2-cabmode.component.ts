import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';
import { isOk } from '../../../model/ApiResponse';
import { BotPermissionService } from '../../../bot-permission.service';
import {
  CABINET_LEVELS,
  CabinetLevelResult,
  CabinetSettingItem,
  CabinetSummary,
  LC_MODES,
  LCSET_KEYS,
} from '../model/CabinetModels';

/**
 * 页② 机台控制（设计 §8；v2 D13 分档）：
 * LC 模式卡 + 传统重启卡：激活用户（P≥1 持授权行）均可用；
 * LC 功能卡（EP-10）：仅 P≥4（完整 19 项，P≤3 整卡隐藏）；
 * 管理区机台级别卡（EP-11）：P≥4 显示——P4-6 仅 2..5 档，P≥7 全档 -1..7。
 */
@Component({
  selector: 'app-maimai2-cabmode',
  templateUrl: './maimai2-cabmode.component.html',
  styleUrls: ['./maimai2-cabmode.component.css'],
  standalone: false
})
export class Maimai2CabmodeComponent implements OnInit {

  protected readonly LC_MODES = LC_MODES;
  protected readonly CABINET_LEVELS = CABINET_LEVELS;
  /** 模板用阈值常量（与 BotPermissionService / 后端 PermissionLevels 对齐） */
  readonly MANAGE_GRANTS = BotPermissionService.MANAGE_GRANTS;
  readonly MANAGE_PERMISSIONS = BotPermissionService.MANAGE_PERMISSIONS;

  cabinets: CabinetSummary[] = [];
  selectedNick = '';

  info: { isSpecialMode: number; isRebooting: boolean; level: number; settings: CabinetSettingItem[] } | null = null;

  selectedMode = -1;
  rebooting = false;
  permission = 0;

  lcsetKeys: { key: string; setting: string }[] = [];
  lcsetKey = '';
  lcsetVal = '';

  selectedLevel = 3;
  levelResult: CabinetLevelResult | null = null;

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
    this.permission = this.botPermission.currentValue.permission;
    // v2 D13：LCset 仅 P≥4（完整 19 项）；P≤3 返回空（整卡隐藏）
    this.lcsetKeys = BotPermissionService.filterLcsetKeys(this.permission, LCSET_KEYS);
    this.loadCabinets();
  }

  /** 级别下拉选项（v2 D13）：P4-6 仅 2..5；P≥7 全档 -1..7 */
  get cabinetLevelOptions(): typeof CABINET_LEVELS {
    return this.permission >= this.MANAGE_PERMISSIONS
      ? CABINET_LEVELS
      : CABINET_LEVELS.filter(l => l.level >= 2 && l.level <= 5);
  }

  userName(): string {
    return this.userService.currentUser?.username ?? '';
  }

  loadCabinets(): void {
    this.api.getLcdx(`lcdx/cabinet/controllable/${encodeURIComponent(this.userName())}`).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp) && Array.isArray(resp.data)) {
          this.cabinets = resp.data;
          if (this.cabinets.length > 0) {
            this.selectedNick = this.cabinets[0].nickName ?? this.cabinets[0].fullKeychip;
            this.loadInfo();
          }
        }
      })
    });
  }

  onCabinetChange(): void {
    this.loadInfo();
  }

  loadInfo(): void {
    this.api.getLcdx(`lcdx/cabinet/info/${encodeURIComponent(this.userName())}/${encodeURIComponent(this.selectedNick)}`)
      .subscribe(resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.info = resp.data;
          this.selectedMode = resp.data.isSpecialMode;
          this.rebooting = resp.data.isRebooting;
          this.selectedLevel = resp.data.level;
        }
      }));
  }

  get modeChanged(): boolean {
    return this.info != null && this.selectedMode !== this.info.isSpecialMode;
  }

  setMode(mode: number): void {
    this.selectedMode = mode;
  }

  submitMode(): void {
    this.api.postLcdx('lcdx/cabinet/mode',
      {userName: this.userName(), nickName: this.selectedNick, mode: this.selectedMode}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.messageService.notice('OK');
          this.loadInfo();
        } else {
          this.messageService.notice(resp?.status?.message ?? 'Failed');
        }
      })
    });
  }

  toggleReboot(): void {
    const enable = !this.rebooting;
    // 读即清语义：机台下次心跳空闲时自动重启；设置需二次确认（i18n key: Maimai2.CabinetControl.RebootConfirm）
    if (enable && !confirm('机台将在下次心跳（空闲时）自动重启，确认设置？')) {
      return;
    }
    this.api.postLcdx('lcdx/cabinet/reboot',
      {userName: this.userName(), nickName: this.selectedNick, enable}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.messageService.notice(resp.data?.message ?? 'OK');
          this.loadInfo();
        } else {
          this.messageService.notice(resp?.status?.message ?? 'Failed');
        }
      })
    });
  }

  submitLcset(): void {
    this.api.postLcdx('lcdx/cabinet/lcset',
      {userName: this.userName(), nickName: this.selectedNick, key: this.lcsetKey, val: this.lcsetVal}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.messageService.notice('OK');
          this.lcsetVal = '';
          this.loadInfo();
        } else {
          this.messageService.notice(resp?.status?.message ?? 'Failed');
        }
      })
    });
  }

  submitLevel(): void {
    this.api.postLcdx('lcdx/cabinet/level',
      {userName: this.userName(), nickName: this.selectedNick, level: this.selectedLevel}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.levelResult = resp.data;
          this.messageService.notice('OK');
          this.loadInfo();
        } else {
          this.messageService.notice(resp?.status?.message ?? 'Failed');
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
