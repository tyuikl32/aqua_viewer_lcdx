import { Component, OnDestroy, OnInit } from '@angular/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';
import { StatusCode } from '../../../status-code';
import {
  CabinetInfo,
  CabinetPlayers,
  CabinetSummary,
  DeliveryStatus,
  DownloadProgress,
  truncateFileName,
} from '../model/CabinetModels';

/**
 * 页① 机台管理（设计 §8）：EP-19 机台下拉 + 四卡片（EP-04 状态 / EP-05 人数 / EP-06 配信 / EP-07 进度）
 * + 手动刷新 + 30s 自动刷新开关。
 */
@Component({
  selector: 'app-maimai2-cabinets',
  templateUrl: './maimai2-cabinets.component.html',
  styleUrls: ['./maimai2-cabinets.component.css'],
  standalone: false
})
export class Maimai2CabinetsComponent implements OnInit, OnDestroy {

  protected readonly truncateFileName = truncateFileName;

  cabinets: CabinetSummary[] = [];
  selectedNick: string = '';
  hasManage = false;

  info: CabinetInfo | null = null;
  players: CabinetPlayers | null = null;
  delivery: DeliveryStatus | null = null;
  dlprog: DownloadProgress | null = null;

  autoRefresh = false;
  private timer: any = null;
  private static readonly REFRESH_MS = 30_000;

  constructor(
    private api: ApiService,
    private userService: UserService,
    private messageService: MessageService,
  ) {
  }

  ngOnInit(): void {
    this.hasManage = this.userService.currentUser != null;
    this.loadCabinets();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  userName(): string {
    return this.userService.currentUser?.username ?? '';
  }

  loadCabinets(): void {
    this.api.getLcdx(`lcdx/cabinet/controllable/${encodeURIComponent(this.userName())}`).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK && Array.isArray(resp.data)) {
          this.cabinets = resp.data;
          if (this.cabinets.length > 0 && !this.cabinets.some(c => c.nickName === this.selectedNick)) {
            this.selectedNick = this.cabinets[0].nickName ?? this.cabinets[0].fullKeychip;
            this.refreshAll();
          }
        }
      },
      error: () => this.messageService.notice('Failed to load cabinets')
    });
  }

  onCabinetChange(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    if (!this.selectedNick) {
      return;
    }
    this.loadInfo();
    this.loadPlayers();
    this.loadDelivery();
    this.loadDlprog();
  }

  private loadInfo(): void {
    this.api.getLcdx(`lcdx/cabinet/info/${encodeURIComponent(this.userName())}/${encodeURIComponent(this.selectedNick)}`)
      .subscribe(resp => this.info = resp?.status?.code === StatusCode.OK ? resp.data : null);
  }

  private loadPlayers(): void {
    this.api.getLcdx(`lcdx/cabinet/players/${encodeURIComponent(this.userName())}/${encodeURIComponent(this.selectedNick)}`)
      .subscribe(resp => this.players = resp?.status?.code === StatusCode.OK ? resp.data : null);
  }

  private loadDelivery(): void {
    this.api.getLcdx(`lcdx/cabinet/delivery/${encodeURIComponent(this.userName())}/${encodeURIComponent(this.selectedNick)}`)
      .subscribe(resp => this.delivery = resp?.status?.code === StatusCode.OK ? resp.data : null);
  }

  private loadDlprog(): void {
    this.api.getLcdx(`lcdx/cabinet/dlprog/${encodeURIComponent(this.userName())}/${encodeURIComponent(this.selectedNick)}`)
      .subscribe(resp => this.dlprog = resp?.status?.code === StatusCode.OK ? resp.data : null);
  }

  progressBadgeClass(progressText: string): string {
    if (progressText === 'Done') {
      return 'text-bg-success';
    }
    if (progressText === 'Error' || progressText === 'HashError' || progressText === 'Incomplete') {
      return 'text-bg-danger';
    }
    return 'text-bg-info';
  }

  toggleAutoRefresh(): void {
    if (this.autoRefresh) {
      this.stopAutoRefresh();
      this.autoRefresh = false;
    } else {
      this.timer = setInterval(() => this.refreshAll(), Maimai2CabinetsComponent.REFRESH_MS);
      this.autoRefresh = true;
    }
  }

  private stopAutoRefresh(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
