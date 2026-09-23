import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';
import { isOk } from '../../../model/ApiResponse';
import { BotPermissionService } from '../../../bot-permission.service';
import {
  CABINET_LEVELS,
  CabModeItem,
  CabinetLevelResult,
  CabinetSettingItem,
  CabinetSummary,
  LC_MODES,
  LCSET_KEYS,
} from '../model/CabinetModels';

/**
 * 页② 机台控制（设计 §8；v2 D13 分档）：
 * LC 模式卡 + 传统重启卡：激活用户（P≥1 持授权行）均可用；
 * LC 功能卡（EP-10）：仅 P≥4（完整 9 项，P≤3 整卡隐藏）；
 * 管理区机台级别卡（EP-11）：P≥4 显示——P4-6 仅 2..5 档，P≥7 全档 -1..7。
 * LC 模式选项来自 CabmodeList（IsEnabled + 机台 level ≥ 目录最低档）；LC_MODES 仅作 API 失败回退。
 */
@Component({
  selector: 'app-maimai2-cabmode',
  templateUrl: './maimai2-cabmode.component.html',
  styleUrls: ['./maimai2-cabmode.component.css'],
  standalone: false
})
export class Maimai2CabmodeComponent implements OnInit, OnDestroy {

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

  /** CabmodeList 实时目录；空数组表示尚未加载或 API 失败（回退 LC_MODES） */
  cabModes: CabModeItem[] = [];

  lcsetKeys: { key: string; setting: string; default?: string; note?: string }[] = [];
  lcsetKey = '';
  lcsetVal = '';

  selectedLevel = 3;
  levelResult: CabinetLevelResult | null = null;

  private permissionSubscription: Subscription | null = null;

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
    // Permission 在用户资料加载后才回来；首屏若只读一次会把 P≥4 功能卡永久藏掉
    this.permissionSubscription = this.botPermission.state.subscribe(state => {
      this.permission = state.permission;
      this.lcsetKeys = BotPermissionService.filterLcsetKeys(state.permission, LCSET_KEYS);
      this.changeDetector.markForCheck();
    });
    this.loadCabModes();
    this.loadCabinets();
  }

  ngOnDestroy(): void {
    this.permissionSubscription?.unsubscribe();
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

  loadCabModes(): void {
    this.api.getLcdx(`lcdx/cabinet/modes/${encodeURIComponent(this.userName())}`).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp) && resp.data?.modes) {
          this.cabModes = resp.data.modes;
        }
      })
    });
  }

  /** 可选模式：目录已滤 IsEnabled；此处再滤机台 level ≥ 目录最低档；无目录时回退 LC_MODES */
  get visibleModes(): { mode: number; label: string }[] {
    if (this.cabModes.length > 0) {
      const cabLevel = this.info?.level;
      return this.cabModes
        .filter(m => cabLevel === undefined || cabLevel >= m.level)
        .map(m => ({ mode: m.id, label: this.formatModeButtonLabel(m.name) }));
    }
    return LC_MODES.map(m => ({ mode: m.mode, label: '' }));
  }

  /**
   * 按钮长名换行（只插入显式 \n，CSS 用 pre 不再按空格自动折）：
   * 1. 含「maimai でらっくす」时在品牌后断行，版本名整段保留在第二行（CiRCLE PLUS / PRiSM 不拆）
   * 2. 否则显示宽度 > 16 时在最后一个空格拆行（CJK/全角计 2）
   */
  formatModeButtonLabel(name: string): string {
    const brand = 'maimai でらっくす';
    const brandIdx = name.indexOf(brand);
    if (brandIdx >= 0) {
      const head = name.slice(0, brandIdx + brand.length).trimEnd();
      const tail = name.slice(brandIdx + brand.length).trim();
      if (tail) {
        return `${head}\n${tail}`;
      }
      return head;
    }
    if (this.displayWidth(name) <= 16) {
      return name;
    }
    const lastSpace = name.lastIndexOf(' ');
    if (lastSpace > 0) {
      return name.slice(0, lastSpace) + '\n' + name.slice(lastSpace + 1);
    }
    return name;
  }

  private displayWidth(s: string): number {
    let w = 0;
    for (const ch of s) {
      const code = ch.codePointAt(0) ?? 0;
      w += (code >= 0x1100 && code <= 0x115F)
        || (code >= 0x2E80 && code <= 0xA4CF)
        || (code >= 0xAC00 && code <= 0xD7A3)
        || (code >= 0xF900 && code <= 0xFAFF)
        || (code >= 0xFE30 && code <= 0xFE6F)
        || (code >= 0xFF00 && code <= 0xFF60)
        || (code >= 0xFFE0 && code <= 0xFFE6)
        ? 2 : 1;
    }
    return w;
  }

  /** 当前模式文案：4（名称）；查不到 DB 名时回退 i18n Mode* */
  get currentModeLabel(): string {
    const id = this.info?.isSpecialMode;
    if (id === undefined || id === null) {
      return '';
    }
    const fromDb = this.cabModes.find(m => m.id === id)?.name;
    if (fromDb) {
      return `${id}（${fromDb}）`;
    }
    return String(id);
  }

  /** fallback 模式名的 i18n key（无 DB 名时） */
  currentModeFallbackLabelKey(): string {
    const id = this.info?.isSpecialMode;
    return LC_MODES.find(m => m.mode === id)?.labelKey ?? '';
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
          this.messageService.noticeTranslated('Maimai2.CabinetControl.Success');
          this.loadInfo();
        } else {
          this.messageService.noticeTranslated('Maimai2.CabinetControl.Failed');
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
          this.messageService.noticeTranslated('Maimai2.CabinetControl.Success');
          this.loadInfo();
        } else {
          this.messageService.noticeTranslated('Maimai2.CabinetControl.Failed');
        }
      })
    });
  }

  submitLcset(): void {
    this.api.postLcdx('lcdx/cabinet/lcset',
      {userName: this.userName(), nickName: this.selectedNick, key: this.lcsetKey, val: this.lcsetVal}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.messageService.noticeTranslated('Maimai2.CabinetControl.Success');
          this.lcsetVal = '';
          this.loadInfo();
        } else {
          this.messageService.noticeTranslated('Maimai2.CabinetControl.Failed');
        }
      })
    });
  }

  /** 当前选中的 lcset key 是否存在恢复默认值 */
  get currentLcsetDefault(): string | undefined {
    return this.lcsetKeys.find(k => k.key === this.lcsetKey)?.default;
  }

  /** 当前选中的 lcset key 的输入格式提示（如 cc 的格式(0,1)），仅作 placeholder/辅助说明，不锁定输入 */
  get currentLcsetNote(): string | undefined {
    return this.lcsetKeys.find(k => k.key === this.lcsetKey)?.note;
  }

  /** 恢复默认值：将输入框填为当前 key 的 default（无 default 的 key 按钮已禁用） */
  restoreDefault(): void {
    const d = this.currentLcsetDefault;
    if (d !== undefined) {
      this.lcsetVal = d;
    }
  }

  submitLevel(): void {
    this.api.postLcdx('lcdx/cabinet/level',
      {userName: this.userName(), nickName: this.selectedNick, level: this.selectedLevel}).subscribe({
      next: resp => this.runInAngular(() => {
        if (isOk(resp)) {
          this.levelResult = resp.data;
          this.messageService.noticeTranslated('Maimai2.CabinetControl.Success');
          this.loadInfo();
        } else {
          this.messageService.noticeTranslated('Maimai2.CabinetControl.Failed');
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
