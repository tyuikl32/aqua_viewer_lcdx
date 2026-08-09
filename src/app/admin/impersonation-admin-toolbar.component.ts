import {Component, OnInit} from '@angular/core';
import {ImpersonationAdminAction, ImpersonationService} from '../auth/impersonation.service';

type WriteAdminAction = Exclude<ImpersonationAdminAction, 'refresh-admin-context'>;

@Component({selector: 'app-impersonation-admin-toolbar', templateUrl: './impersonation-admin-toolbar.component.html',
  styleUrls: ['./impersonation-admin-toolbar.component.css'], standalone: false})
export class ImpersonationAdminToolbarComponent implements OnInit {
  data: any;
  extId = '';
  externalLuid = '';
  game = 'CHUSAN';
  status = 0;
  message = '';
  messageType: 'success' | 'error' = 'success';
  pending = false;
  private requestVersion = 0;
  constructor(public impersonation: ImpersonationService) {}
  ngOnInit() { void this.refresh(); }

  get extIdValue(): number | null {
    const input = this.extId.trim();
    if (!/^\d+$/.test(input)) return null;
    const value = Number(input);
    return Number.isSafeInteger(value) ? value : null;
  }

  async run(action: WriteAdminAction, payload: any): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.pending = true;
    this.message = '';
    try {
      const data = await this.impersonation.requestAdminAction(action, payload);
      if (requestVersion !== this.requestVersion) return;
      const successMessage = this.successMessage(action, payload);
      if (data?.account) {
        this.data = data;
      } else {
        try {
          await this.loadContext(requestVersion);
        } catch (error) {
          if (requestVersion === this.requestVersion) {
            this.messageType = 'error';
            this.message = `${successMessage}，但账户信息刷新失败：${this.errorMessage(error)}`;
          }
          return;
        }
      }
      if (requestVersion !== this.requestVersion) return;
      this.messageType = 'success';
      this.message = successMessage;
    } catch (error) {
      if (requestVersion === this.requestVersion) this.showError(error);
    } finally {
      if (requestVersion === this.requestVersion) this.pending = false;
    }
  }

  async refresh(): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.pending = true;
    this.message = '';
    try {
      await this.loadContext(requestVersion);
    } catch (error) {
      if (requestVersion === this.requestVersion) this.showError(error);
    } finally {
      if (requestVersion === this.requestVersion) this.pending = false;
    }
  }

  private async loadContext(requestVersion: number): Promise<void> {
    const data = await this.impersonation.requestAdminAction('refresh-admin-context', {});
    if (requestVersion === this.requestVersion && data?.account) this.data = data;
  }

  private showError(error: unknown) {
    this.messageType = 'error';
    this.message = this.errorMessage(error);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private successMessage(action: WriteAdminAction, payload: any) {
    switch (action) {
      case 'bind-card-by-ext-id': return `卡片 ${payload.extId} 已绑定`;
      case 'unbind-card-by-ext-id': return `卡片 ${payload.extId} 已解绑`;
      case 'set-default-card': return `卡片 ${payload.extId} 已设为默认卡片`;
      case 'remove-external-code': return `卡片 ${payload.extId} 的外部 Access Code 已删除`;
      case 'set-game-ban-state':
        return `${payload.game} 卡片 ${payload.extId} 的封禁状态已设为 ${payload.status}`;
    }
  }
}
