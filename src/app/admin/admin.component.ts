import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {FormControl} from '@angular/forms';
import {combineLatest, ReplaySubject, startWith, tap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';
import {ApiService} from '../api.service';
import {MessageService} from '../message.service';
import {Card, User} from '../user.service';
import {StatusCode} from '../status-code';
import {V2Profile} from '../sega/chunithm/v2/model/V2Profile';
import {DisplayOngekiProfile} from '../sega/ongeki/model/OngekiProfile';
import {DisplayMaimai2Profile} from '../sega/maimai2/model/Maimai2Profile';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {TranslateService} from '@ngx-translate/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {IMPERSONATION_KEY} from '../auth/account.service';
import {IMPERSONATE_GRANT, IMPERSONATE_REQUEST, IMPERSONATE_ADMIN_REQUEST, IMPERSONATE_ADMIN_RESPONSE,
  IMPERSONATION_ADMIN_CONTEXT_KEY, ImpersonationAdminAction} from '../auth/impersonation.service';
import {isTrustedImpersonationAdminEnvelope} from '../auth/impersonation.service';
import {marked} from 'marked';
import DOMPurify from 'dompurify';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class AdminComponent implements OnInit {
  private pageSubject = new ReplaySubject<number>();
  currentPage = 1;
  totalElements = 0;
  loading = true;

  tab = 'users';

  patternControl = new FormControl('');
  fieldControl = new FormControl('all');

  userList: AdvancedUser[];

  selectedProfile: any = null;
  rawJson: string = null;
  creatingUser = false;

  keychips: any[] = null;
  kcPatternControl = new FormControl('');
  kcCurrentPage = 1;
  kcTotalElements = 0;

  impersonateUrl: SafeResourceUrl = null;
  impersonateUsername: string = null;
  private impersonateNonce: string = null;
  private impersonateAccount: any = null;
  private impersonateListener: (event: MessageEvent) => void = null;
  private readonly impersonateActions: ImpersonationAdminAction[] = ['bind-card-by-ext-id', 'unbind-card-by-ext-id',
    'set-default-card', 'remove-external-code', 'set-game-ban-state', 'refresh-admin-context'];
  eulaCurrent: any = null;
  eulaDraftTitle = '';
  eulaDraftContent = '';
  eulaPreview = '';

  constructor(
    private api: ApiService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private translate: TranslateService,
    private sanitizer: DomSanitizer,
    protected modalService: NgbModal
  ) {

  }

  ngOnInit(): void {
    combineLatest([
      this.pageSubject.pipe(startWith(0)),
    ]).subscribe(([page]) => {
      this.load(page, this.patternControl.value);
    });
    this.loadKeychips(0);
  }

  load(page: number, pattern: string) {
    this.currentPage = page + 1;
    const params: any = {page, size: 12, field: this.fieldControl.value || 'all'};
    if (pattern !== '') {
      params.pattern = pattern;
    }
    this.api.get('api/admin/advancedUserSearch', params).subscribe({
      next: resp => {
        const statusCode: StatusCode = resp.status.code;
        if (statusCode === StatusCode.OK && resp.data) {
          this.userList = resp.data.content;
          this.totalElements = resp.data.totalElements;
        }
        else{
          this.messageService.notice(resp.status.message, 'warning');
        }
        this.loading = false;
      },
      error: err => {
        this.messageService.notice(err.message, 'warning');
        this.loading = false;
      }
    });
  }

  search() {
    this.load(0, this.patternControl.value);
  }

  pageChanged(page: number) {
    this.pageSubject.next(page - 1);
  }

  /**
   * Opens the portal as another user in an iframe instead of replacing the admin's
   * own session, so returning is just closing the frame.
   */
  loginAs(username: string, impersonateModal: any){
    this.api.post(`api/admin/users/loginas/${username}`, {}).subscribe({
      next: resp => {
        if (resp?.status?.code !== StatusCode.OK || !resp.data) {
          this.messageService.notice(resp?.status?.message);
          return;
        }
        this.startImpersonation(username, resp.data, impersonateModal);
      },
      error: err => {
        this.messageService.notice(err.message ?? err, 'warning');
        console.warn('login as fail', err);
      }
    });
  }

  private startImpersonation(username: string, account: any, impersonateModal: any) {
    this.impersonateUsername = username;
    this.impersonateAccount = account;
    // A fresh nonce tells the iframe to drop any earlier target's session
    this.impersonateNonce = crypto.randomUUID();
    this.impersonateUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `${location.origin}/?imp=${this.impersonateNonce}`);

    // The iframe asks for the tokens once it has booted; storage cannot be used to
    // pass them because it is shared with this page
    this.impersonateListener = (event: MessageEvent) => {
      const frame = document.querySelector('iframe.impersonation-frame') as HTMLIFrameElement;
      if (event.origin !== location.origin || event.source !== frame?.contentWindow ||
        event.data?.nonce !== this.impersonateNonce) {
        return;
      }
      if (event.data?.type === IMPERSONATE_REQUEST) {
        (event.source as Window)?.postMessage({type: IMPERSONATE_GRANT, nonce: this.impersonateNonce,
          account: this.impersonateAccount, adminContext: {nonce: this.impersonateNonce,
            target: this.impersonateUsername, actions: this.impersonateActions}}, location.origin);
        return;
      }
      if (event.data?.type === IMPERSONATE_ADMIN_REQUEST) this.handleImpersonationAdminRequest(event);
    };
    window.addEventListener('message', this.impersonateListener);

    (document.activeElement as HTMLElement)?.blur();
    this.modalService.open(impersonateModal, {fullscreen: true, backdrop: 'static', keyboard: false})
      .result.then(() => this.endImpersonation(), () => this.endImpersonation());
  }

  /**
   * Wipes the impersonated session out of the frame and revokes its refresh token,
   * so closing the frame really ends the session instead of leaving a week-long
   * token behind.
   */
  closeImpersonation(modal: any) {
    const frame = document.querySelector('iframe.impersonation-frame') as HTMLIFrameElement;
    try {
      frame?.contentWindow?.sessionStorage?.removeItem(IMPERSONATION_KEY);
      frame?.contentWindow?.sessionStorage?.removeItem(IMPERSONATION_ADMIN_CONTEXT_KEY);
    } catch (e) {
      console.warn('could not clear impersonated session', e);
    }
    const refreshToken = this.impersonateAccount?.refreshToken;
    if (refreshToken) {
      // signout authorises on the refresh token itself, so the admin's own header
      // on this request is irrelevant
      this.api.post('api/auth/signout', {refreshToken}).subscribe({
        next: () => {},
        error: err => console.warn('could not revoke impersonated session', err)
      });
    }
    // Invalidate source/nonce/target and remove the message listener before the
    // modal begins closing, so a stale frame cannot race the close lifecycle.
    this.endImpersonation();
    modal.close();
  }

  private endImpersonation() {
    if (this.impersonateListener) {
      window.removeEventListener('message', this.impersonateListener);
      this.impersonateListener = null;
    }
    this.impersonateUrl = null;
    this.impersonateUsername = null;
    this.impersonateAccount = null;
    this.impersonateNonce = null;
  }

  refresh() {
    this.load(this.currentPage - 1, this.patternControl.value);
  }

  /** Renders a JSON value with the tokens wrapped for colouring. */
  private highlightJson(value: any): string {
    const json = JSON.stringify(value, null, 2)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return json.replace(
      /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      match => {
        let cls = 'json-number';
        if (match.startsWith('"')) {
          cls = match.trimEnd().endsWith(':') ? 'json-key' : 'json-string';
        } else if (match === 'true' || match === 'false') {
          cls = 'json-boolean';
        } else if (match === 'null') {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      });
  }

  openRawJson(item: AdvancedUser, tpl: any) {
    // Computed on demand rather than bound, so change detection does not re-highlight
    this.rawJson = this.highlightJson(item);
    (document.activeElement as HTMLElement)?.blur();
    this.modalService.open(tpl, {centered: true, scrollable: true, size: 'lg'});
  }

  gameProfileOf(profile: GameProfile, game: 'chusan' | 'ongeki' | 'maimai2') {
    return profile[game];
  }

  openUser(item: AdvancedUser, tpl: any) {
    this.selectedProfile = null;
    this.rawJson = null;
    this.api.get(`api/admin/accounts/${item.user.username}`).subscribe({
      next: resp => {
        const statusCode: StatusCode = resp?.status?.code;
        if ((statusCode === StatusCode.USER_FETCH_SUCCESS || statusCode === StatusCode.OK) && resp.data) {
          this.selectedProfile = {...resp.data.account, totpEnabled: resp.data.totpEnabled,
            passkeys: resp.data.passkeys, oauthIdentities: resp.data.oauthIdentities, eulaStatus: resp.data.eulaStatus};
        }
      },
      error: () => {}
    });
    this.modalService.open(tpl, {centered: true, scrollable: true});
  }

  private handleImpersonationAdminRequest(event: MessageEvent) {
    const message = event.data;
    const action = message?.action as ImpersonationAdminAction;
    const frame = document.querySelector('iframe.impersonation-frame') as HTMLIFrameElement;
    if (!isTrustedImpersonationAdminEnvelope(event, frame?.contentWindow, this.impersonateNonce,
      this.impersonateUsername, this.impersonateActions) || !this.validAdminPayload(action, message.payload)) return;
    const target = this.impersonateUsername;
    const p = message.payload || {};
    let request: any;
    switch (action) {
      case 'bind-card-by-ext-id':
        request = this.api.post('api/admin/bindCardViaExtId', {userName: target, extId: p.extId}); break;
      case 'unbind-card-by-ext-id':
        request = this.api.delete(`api/admin/accounts/${target}/cards/${p.extId}`); break;
      case 'set-default-card':
        request = this.api.put(`api/admin/accounts/${target}/cards/${p.extId}/default`, {}); break;
      case 'remove-external-code':
        request = this.api.delete(`api/admin/accounts/${target}/cards/${p.extId}/external/${encodeURIComponent(p.luid)}`); break;
      case 'set-game-ban-state':
        request = this.api.put(`api/admin/accounts/${target}/games/${p.game}/${p.extId}/ban-state`, {status: p.status}); break;
      case 'refresh-admin-context':
        request = this.api.get(`api/admin/accounts/${target}`); break;
    }
    request.subscribe({
      next: resp => {
        const ok = resp?.status?.code === StatusCode.OK;
        this.replyImpersonation(event.source as Window, message, ok, resp?.data,
          ok ? undefined : (resp?.status?.message || 'Admin action failed'));
      },
      error: error => this.replyImpersonation(event.source as Window, message, false, null, String(error))
    });
  }

  private validAdminPayload(action: ImpersonationAdminAction, payload: any) {
    if (action === 'refresh-admin-context') return payload && Object.keys(payload).length === 0;
    if (!payload || !Number.isSafeInteger(payload.extId) || payload.extId < 0) return false;
    if (action === 'remove-external-code') return Object.keys(payload).sort().join(',') === 'extId,luid' &&
      typeof payload.luid === 'string' && payload.luid.length === 20;
    if (action === 'set-game-ban-state') return Object.keys(payload).sort().join(',') === 'extId,game,status' &&
      ['CHUSAN', 'MAIMAI2', 'ONGEKI'].includes(payload.game) && Number.isInteger(payload.status) &&
      payload.status >= 0 && payload.status <= 2;
    return Object.keys(payload).length === 1;
  }

  private replyImpersonation(target: Window, request: any, ok: boolean, data?: any, error?: string) {
    if (!this.impersonateNonce || request.nonce !== this.impersonateNonce || request.target !== this.impersonateUsername) return;
    target.postMessage({type: IMPERSONATE_ADMIN_RESPONSE, nonce: this.impersonateNonce,
      target: this.impersonateUsername, requestId: request.requestId, ok, data, error}, location.origin);
  }

  isAdminTarget(item: AdvancedUser) {
    return (item.user.roles || []).some(role => role.name === 'ROLE_ADMIN');
  }

  isBanned(item: AdvancedUser) {
    return !(item.user.roles || []).some(role => role.name === 'ROLE_USER');
  }

  setAccountBan(item: AdvancedUser, banned: boolean) {
    const warning = banned
      ? `封禁 ${item.user.username}？其现有 Chusan、Maimai2、Ongeki 档案会设为 2，所有 refresh 会话会撤销。`
      : `解除 ${item.user.username} 的面板封禁？游戏封禁值不会自动恢复。`;
    if (!confirm(warning)) return;
    this.api.post(`api/admin/accounts/${item.user.username}/${banned ? 'ban' : 'unban'}`, {}).subscribe({
      next: resp => { this.messageService.notice(resp?.status?.message); this.refresh(); },
      error: err => this.messageService.notice(err, 'warning')
    });
  }

  setGameBan(username: string, game: string, extId: number, status: string) {
    this.api.put(`api/admin/accounts/${username}/games/${game}/${extId}/ban-state`, {status: Number(status)}).subscribe({
      next: resp => {
        this.messageService.notice(resp?.status?.message);
        this.refresh();
        if (resp?.status?.code === StatusCode.OK && this.selectedProfile?.username === username) this.openSupport(username);
      },
      error: err => this.messageService.notice(err, 'warning')
    });
  }

  deleteGameSave(username: string, game: string, extId: number) {
    const confirmation = prompt(`不可恢复：删除 ${username} / ${extId} / ${game} 的完整游戏存档。下次游玩会创建全新档案。\n请输入完整 ExtId 确认：`);
    if (confirmation !== String(extId)) return;
    this.api.delete(`api/admin/accounts/${username}/games/${game}/${extId}`, {confirmExtId: String(extId)} as any).subscribe({
      next: resp => {
        this.messageService.notice(resp?.status?.message);
        this.refresh();
        if (resp?.status?.code === StatusCode.OK && this.selectedProfile?.username === username) this.openSupport(username);
      },
      error: err => this.messageService.notice(err, 'warning')
    });
  }

  revokeSessions(username: string) {
    if (!confirm(`撤销 ${username} 的全部 refresh 会话？现有 access token 最多约 5 分钟后失效。`)) return;
    this.api.post(`api/admin/accounts/${username}/sessions/revoke`, {}).subscribe(resp => this.messageService.notice(resp?.status?.message));
  }

  deletePasskey(username: string, id: number) {
    if (!confirm('删除此 Passkey 并撤销该用户全部 refresh 会话？')) return;
    this.api.delete(`api/admin/accounts/${username}/passkeys/${id}`).subscribe(() => this.openSupport(username));
  }

  deleteOauth(username: string, id: number) {
    if (!confirm('解绑此 OAuth identity 并撤销该用户全部 refresh 会话？')) return;
    this.api.delete(`api/admin/accounts/${username}/oauth/${id}`).subscribe(() => this.openSupport(username));
  }

  setDefaultCard(username: string, extId: number) {
    if (!confirm(`将 ExtId ${extId} 设为 ${username} 的默认卡？`)) return;
    this.api.put(`api/admin/accounts/${username}/cards/${extId}/default`, {}).subscribe(() => this.openSupport(username));
  }

  unbindCardByExtId(username: string, extId: number) {
    if (!confirm(`解绑 ${username} 的 ExtId ${extId}？关联 Access Code 会一并移除。`)) return;
    this.api.delete(`api/admin/accounts/${username}/cards/${extId}`).subscribe(() => { this.openSupport(username); this.refresh(); });
  }

  removeExternal(username: string, extId: number, luid: string) {
    if (!confirm(`从 ExtId ${extId} 删除外部 Access Code ${luid}？`)) return;
    this.api.delete(`api/admin/accounts/${username}/cards/${extId}/external/${luid}`).subscribe(() => this.openSupport(username));
  }

  private openSupport(username: string) {
    this.api.get(`api/admin/accounts/${username}`).subscribe(resp => {
      this.selectedProfile = {...resp.data.account, totpEnabled: resp.data.totpEnabled,
        passkeys: resp.data.passkeys, oauthIdentities: resp.data.oauthIdentities, eulaStatus: resp.data.eulaStatus};
    });
  }

  loadEula() {
    this.tab = 'eula';
    this.api.get('api/admin/eula').subscribe(resp => {
      this.eulaCurrent = resp.data.current;
      this.eulaDraftTitle = resp.data.draft?.title ?? `${resp.data.current.title}`;
      this.eulaDraftContent = resp.data.draft?.content ?? resp.data.current.content;
      this.updateEulaPreview();
    });
  }

  updateEulaPreview() {
    this.eulaPreview = DOMPurify.sanitize(marked.parse(this.eulaDraftContent || '') as string);
  }

  saveEulaDraft() {
    this.api.put('api/admin/eula/draft', {title: this.eulaDraftTitle, content: this.eulaDraftContent})
      .subscribe(resp => this.messageService.notice(resp?.status?.message));
  }

  publishEula() {
    if (!confirm('发布新版本后，全部用户（包括管理员）都必须重新同意。继续发布？')) return;
    this.api.post('api/admin/eula/publish', {}).subscribe({
      next: () => location.assign('/eula'),
      error: err => this.messageService.notice(err, 'warning')
    });
  }

  createUser(userName: string, name: string, email: string, password: string) {
    if (!userName || !name || !email || !password) {
      this.messageService.notice('请填写完整的用户信息', 'warning');
      return;
    }
    this.creatingUser = true;
    this.api.post('api/admin/createUser', {userName, name, email, password}).subscribe({
      next: resp => {
        this.creatingUser = false;
        this.messageService.notice(resp?.status?.message);
        if (resp?.status?.code === StatusCode.OK) {
          this.refresh();
        }
      },
      error: err => {
        this.creatingUser = false;
        this.messageService.notice(err.message, 'warning');
      }
    });
  }

  bindCard(userName: string, accessCode: string) {
    this.cardOp('api/admin/bindCard', {userName, accessCode});
  }

  bindCardViaExtId(userName: string, extId: string) {
    const parsed = Number(extId);
    if (!extId || isNaN(parsed)) {
      this.messageService.notice('请输入正确的 ExtId', 'warning');
      return;
    }
    this.cardOp('api/admin/bindCardViaExtId', {userName, extId: parsed});
  }

  unbindCard(userName: string, accessCode: string) {
    this.cardOp('api/admin/unbindCard', {userName, accessCode});
  }

  changeAccessCode(userName: string, accessCode: string, newAccessCode: string) {
    this.cardOp('api/admin/changeAccessCode', {userName, accessCode, newAccessCode});
  }

  /** Support path for a user who lost both their authenticator and recovery codes. */
  resetTotp(username: string) {
    if (!confirm(`确定要重置 ${username} 的两步验证吗？该用户的所有会话会被登出。`)) {
      return;
    }
    this.api.delete(`api/admin/users/${username}/totp`).subscribe({
      next: resp => {
        this.messageService.notice(resp?.status?.message);
        if (this.selectedProfile) {
          this.selectedProfile.totpEnabled = false;
        }
      },
      error: err => this.messageService.notice(err.message, 'warning')
    });
  }

  private cardOp(path: string, body: any) {
    this.api.post(path, body).subscribe({
      next: resp => {
        this.messageService.notice(resp?.status?.message);
        this.refresh();
      },
      error: err => this.messageService.notice(err.message, 'warning')
    });
  }

  loadKeychips(page: number) {
    this.kcCurrentPage = page + 1;
    const params: any = {page, size: 12};
    if (this.kcPatternControl.value) {
      params.pattern = this.kcPatternControl.value;
    }
    this.api.get('api/admin/keychip', params).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK && resp.data) {
          this.keychips = resp.data.content ?? [];
          this.kcTotalElements = resp.data.totalElements;
        }
      },
      error: err => this.messageService.notice(err.message, 'warning')
    });
  }

  kcSearch() {
    this.loadKeychips(0);
  }

  kcPageChanged(page: number) {
    this.loadKeychips(page - 1);
  }

  addKeychip(keychipId: string, placeName: string) {
    if (!keychipId) {
      this.messageService.notice('请输入 Keychip ID', 'warning');
      return;
    }
    const body: any = {keychipId};
    if (placeName) {
      body.placeName = placeName;
    }
    this.api.post('api/admin/keychip', body).subscribe({
      next: resp => {
        this.messageService.notice(resp?.status?.message);
        this.loadKeychips(this.kcCurrentPage - 1);
      },
      error: err => this.messageService.notice(err.message, 'warning')
    });
  }

  deleteKeychip(id: number) {
    if (!confirm('确定要删除这个 Keychip 吗？')) {
      return;
    }
    this.api.delete(`api/admin/keychip/${id}`).subscribe({
      next: () => this.loadKeychips(this.kcCurrentPage - 1),
      error: err => this.messageService.notice(err.message, 'warning')
    });
  }

  toggleWhiteList(keychipId: string) {
    this.api.post('api/admin/keychip/toggleWhiteList', {keychipId}).subscribe({
      next: () => this.loadKeychips(this.kcCurrentPage - 1),
      error: err => this.messageService.notice(err.message, 'warning')
    });
  }
}

export interface AdvancedUser{
  user: User;
  gameProfiles: GameProfile[];
}

export interface GameProfile{
  chusan: any;
  ongeki: any;
  maimai2: any;
  card: Card;
}
