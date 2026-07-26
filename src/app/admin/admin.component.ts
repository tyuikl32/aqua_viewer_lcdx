import {Component, OnInit} from '@angular/core';
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
import {IMPERSONATE_GRANT, IMPERSONATE_REQUEST} from '../auth/impersonation.service';

@Component({
    selector: 'app-admin',
    templateUrl: './admin.component.html',
    styleUrls: ['./admin.component.css'],
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
    this.impersonateNonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
    this.impersonateUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `${location.origin}/?imp=${this.impersonateNonce}`);

    // The iframe asks for the tokens once it has booted; storage cannot be used to
    // pass them because it is shared with this page
    this.impersonateListener = (event: MessageEvent) => {
      if (event.origin !== location.origin
        || event.data?.type !== IMPERSONATE_REQUEST
        || event.data?.nonce !== this.impersonateNonce) {
        return;
      }
      (event.source as Window)?.postMessage(
        {type: IMPERSONATE_GRANT, nonce: this.impersonateNonce, account: this.impersonateAccount},
        location.origin);
    };
    window.addEventListener('message', this.impersonateListener);

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
    this.modalService.open(tpl, {centered: true, scrollable: true, size: 'lg'});
  }

  gameProfileOf(profile: GameProfile, game: 'chusan' | 'ongeki' | 'maimai2') {
    return profile[game];
  }

  openUser(item: AdvancedUser, tpl: any) {
    this.selectedProfile = null;
    this.rawJson = null;
    this.api.get(`api/admin/users/${item.user.username}`).subscribe({
      next: resp => {
        const statusCode: StatusCode = resp?.status?.code;
        if ((statusCode === StatusCode.USER_FETCH_SUCCESS || statusCode === StatusCode.OK) && resp.data) {
          this.selectedProfile = resp.data;
        }
      },
      error: () => {}
    });
    this.modalService.open(tpl, {centered: true, scrollable: true});
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
  chusan: V2Profile;
  ongeki: DisplayOngekiProfile;
  maimai2: DisplayMaimai2Profile;
  card: Card;
}
