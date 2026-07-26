import {MessageService} from 'src/app/message.service';
import {Component, OnInit} from '@angular/core';
import {UserService} from '../user.service';
import {OAuthService} from '../auth/oauth.service';
import {WebAuthnService} from '../auth/webauthn.service';
import {AccountService} from '../auth/account.service';
import {ApiService} from '../api.service';
import {StatusCode} from '../status-code';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import * as bootstrap from 'bootstrap';
import * as QRCode from 'qrcode';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.css'],
    standalone: false
})
export class ProfileComponent implements OnInit{
  providers: string[];
  linkModal: bootstrap.Modal;

  token: string;
  type: string;
  email: string;

  passkeys: any[] = [];
  passkeysLoaded = false;
  webAuthnSupported = false;
  addingPasskey = false;

  totpEnabled = false;
  totpSecret: string;
  totpQr: string;
  totpBusy = false;
  totpRecoveryRemaining = 0;
  // Shown once, right after enabling or regenerating
  recoveryCodes: string[] = null;

  constructor(
    protected oAuthService: OAuthService,
    protected userService: UserService,
    private webAuthn: WebAuthnService,
    private accountService: AccountService,
    private api: ApiService,
    private router: Router,
    private messageService: MessageService,
    private translate: TranslateService,
    protected modalService: NgbModal
  ) {
    this.webAuthnSupported = this.webAuthn.isSupported();
    this.providers = [...this.oAuthService.tokenTypes.keys()];
    const state = this.router.getCurrentNavigation().extras.state;
    if (state) {
      if(this.oAuthService.tokenTypes.has(state.type) && state.token.length === 32){
        this.token = state.token;
        this.type = state.type;
        this.email = state.email;
      }
      history.replaceState({}, document.title);
    }
  }

  ngOnInit(): void {
    this.userService.load();
    this.loadPasskeys();
    this.loadTotpStatus();
    if(this.token && this.type && this.email){
      this.showLinkModal();
    }
  }

  showLinkModal(){
    if (!this.linkModal){
      const modalElement = document.getElementById('link-modal');
      this.linkModal = new bootstrap.Modal(modalElement);
    }
    this.linkModal.show();
  }

  hideLinkModal(){
    if (!this.linkModal){
      const modalElement = document.getElementById('link-modal');
      this.linkModal = new bootstrap.Modal(modalElement);
    }
    this.linkModal.hide();
  }

  link(code?: string){
    const params: any = {
      token: this.token
    }
    if (code) {
      params.code = code;
    }
    this.api.post(`api/user/oauth2`, params).subscribe(
      resp => {
        if (resp?.status) {
          const statusCode: StatusCode = resp.status.code;
          if (statusCode === StatusCode.OK) {
            this.userService.load();
            this.hideLinkModal();
          }
          else if (statusCode === StatusCode.TOTP_REQUIRED || statusCode === StatusCode.TOTP_INVALID
                   || statusCode === StatusCode.TOTP_TOO_MANY_ATTEMPTS) {
            // Keep the modal open so the code can be entered or corrected
            this.notifyTotpCodeError(resp);
          }
          else {
            this.messageService.notice(resp.status.message);
            this.hideLinkModal();
          }
        }
        else{
          this.messageService.notice('Link failed.');
          this.hideLinkModal();
        }
      },
      error => {
        this.messageService.notice(error);
        this.hideLinkModal();
      });
  }

  findOAuth(provider: string){
    return this.userService.currentUser.oauth2s.find(oauth =>{
      return oauth.provider === provider;
    })
  }

  onUnlink(id){
    this.api.delete(`api/user/oauth2/${id}`).subscribe(
      resp => {
        if (resp?.status) {
          const statusCode: StatusCode = resp.status.code;
          if (statusCode === StatusCode.OK) {
            this.userService.load();
          }
          else {
            this.messageService.notice(resp.status.message);
          }
        }
        else{
          this.messageService.notice('Unlink failed.');
        }
      },
      error => {
        this.messageService.notice(error);
      });
  }

  loadPasskeys(){
    this.webAuthn.list().subscribe(
      resp => {
        if (resp?.status?.code === StatusCode.OK) {
          this.passkeys = resp.data ?? [];
        }
        this.passkeysLoaded = true;
      },
      error => {
        this.passkeysLoaded = true;
        console.warn('load passkeys fail', error);
      });
  }

  async onAddPasskey(nick: string, totpCode?: string, modal?: any){
    if (this.addingPasskey) {
      return;
    }
    this.addingPasskey = true;
    try {
      const resp = await this.webAuthn.register(nick?.trim() ? nick.trim() : 'Passkey', totpCode);
      if (resp?.status?.code === StatusCode.TOTP_REQUIRED || resp?.status?.code === StatusCode.TOTP_INVALID
          || resp?.status?.code === StatusCode.TOTP_TOO_MANY_ATTEMPTS) {
        this.notifyTotpCodeError(resp);
        return;
      }
      if (resp?.status?.code === StatusCode.OK) {
        modal?.close();
        this.translate.get('ProfilePage.PasskeyAddedMessage').subscribe((res: string) => {
          this.messageService.notice(res);
        });
        this.loadPasskeys();
      }
      else {
        this.notifyPasskeyError();
      }
    } catch (e) {
      if (!this.webAuthn.isAborted(e)) {
        console.warn('add passkey fail', e);
        this.notifyPasskeyError();
      }
    } finally {
      this.addingPasskey = false;
    }
  }

  onRemovePasskey(id: number){
    this.webAuthn.remove(id).subscribe(
      resp => {
        if (resp?.status?.code === StatusCode.OK) {
          this.loadPasskeys();
        }
        else {
          this.messageService.notice(resp?.status?.message);
        }
      },
      error => {
        this.messageService.notice(error);
      });
  }

  private notifyPasskeyError(){
    this.translate.get('ProfilePage.PasskeyErrorMessage').subscribe((res: string) => {
      this.messageService.notice(res, 'danger');
    });
  }

  loadTotpStatus(){
    this.api.get('api/user/totp').subscribe(
      resp => {
        if (resp?.status?.code === StatusCode.OK) {
          this.totpEnabled = !!resp.data?.enabled;
          this.totpRecoveryRemaining = resp.data?.recoveryCodesRemaining ?? 0;
        }
      },
      error => console.warn('load totp status fail', error));
  }

  /**
   * Requests a fresh secret and renders it as a QR code for the authenticator app.
   * The password is required so a stolen token cannot enrol a secret behind the
   * owner's back.
   */
  startTotpSetup(password: string, modalTemplate: any, passwordModal?: any){
    this.totpBusy = true;
    this.api.post('api/user/totp/setup', {password}).subscribe(
      resp => {
        this.totpBusy = false;
        if (resp?.status?.code === StatusCode.PASSWORD_INCORRECT) {
          // Leave the modal open so the password can simply be retyped
          this.translate.get('ProfilePage.TotpPasswordIncorrect').subscribe((res: string) => {
            this.messageService.notice(res, 'danger');
          });
          return;
        }
        if (resp?.status?.code !== StatusCode.OK || !resp.data) {
          this.messageService.notice(resp?.status?.message);
          passwordModal?.close();
          return;
        }
        passwordModal?.close();
        this.totpSecret = resp.data.secret;
        QRCode.toDataURL(resp.data.uri, {margin: 1, width: 220})
          .then(url => {
            this.totpQr = url;
            this.modalService.open(modalTemplate, {centered: true});
          })
          .catch(err => {
            console.warn('qr render fail', err);
            // The secret can still be typed in manually
            this.totpQr = null;
            this.modalService.open(modalTemplate, {centered: true});
          });
      },
      error => {
        this.totpBusy = false;
        this.messageService.notice(error);
      });
  }

  enableTotp(code: string, modal: any, recoveryTemplate: any){
    this.totpBusy = true;
    this.api.post('api/user/totp/enable', {code}).subscribe(
      resp => {
        this.totpBusy = false;
        if (resp?.status?.code === StatusCode.OK) {
          this.totpEnabled = true;
          this.totpSecret = null;
          this.totpQr = null;
          this.adoptRotatedTokens(resp.data?.tokens);
          modal.close();
          this.translate.get('ProfilePage.TotpEnabledMessage').subscribe((res: string) => this.messageService.notice(res));
          this.showRecoveryCodes(resp.data?.recoveryCodes, recoveryTemplate);
        } else {
          this.notifyTotpCodeError(resp);
        }
      },
      error => {
        this.totpBusy = false;
        this.messageService.notice(error);
      });
  }

  regenerateRecoveryCodes(code: string, modal: any, recoveryTemplate: any){
    this.totpBusy = true;
    this.api.post('api/user/totp/recoveryCodes', {code}).subscribe(
      resp => {
        this.totpBusy = false;
        if (resp?.status?.code === StatusCode.OK) {
          modal.close();
          this.showRecoveryCodes(resp.data?.recoveryCodes, recoveryTemplate);
        } else {
          this.notifyTotpCodeError(resp);
        }
      },
      error => {
        this.totpBusy = false;
        this.messageService.notice(error);
      });
  }

  /**
   * Enabling or disabling revokes every refresh token, including this session's, so
   * the server hands back a fresh pair to keep the current tab signed in.
   */
  private adoptRotatedTokens(tokens: any){
    if (tokens?.accessToken && tokens?.refreshToken) {
      this.accountService.currentAccountValue = {
        ...this.accountService.currentAccountValue,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    }
  }

  /** These are the only time the plaintext codes exist client-side. */
  private showRecoveryCodes(codes: string[], recoveryTemplate: any){
    if (!codes?.length) {
      this.loadTotpStatus();
      return;
    }
    this.recoveryCodes = codes;
    this.totpRecoveryRemaining = codes.length;
    // Esc must not skip the confirmation: these codes are never shown again
    this.modalService.open(recoveryTemplate, {centered: true, backdrop: 'static', keyboard: false});
  }

  copyRecoveryCodes(){
    navigator.clipboard?.writeText(this.recoveryCodes.join('\n')).then(
      () => this.translate.get('ProfilePage.TotpRecoveryCopied').subscribe((res: string) => this.messageService.notice(res)),
      () => {});
  }

  closeRecoveryCodes(modal: any){
    this.recoveryCodes = null;
    modal.close();
    this.loadTotpStatus();
  }

  disableTotp(code: string, modal: any){
    this.totpBusy = true;
    this.api.post('api/user/totp/disable', {code}).subscribe(
      resp => {
        this.totpBusy = false;
        if (resp?.status?.code === StatusCode.OK) {
          this.totpEnabled = false;
          this.totpRecoveryRemaining = 0;
          this.adoptRotatedTokens(resp.data?.tokens);
          modal.close();
          this.translate.get('ProfilePage.TotpDisabledMessage').subscribe((res: string) => this.messageService.notice(res));
        } else {
          this.notifyTotpCodeError(resp);
        }
      },
      error => {
        this.totpBusy = false;
        this.messageService.notice(error);
      });
  }

  private notifyTotpCodeError(resp: any){
    const key = resp?.status?.code === StatusCode.TOTP_INVALID ? 'ProfilePage.TotpInvalidMessage'
      : resp?.status?.code === StatusCode.TOTP_TOO_MANY_ATTEMPTS ? 'ProfilePage.TotpLockedMessage'
      : resp?.status?.code === StatusCode.TOTP_REQUIRED ? 'ProfilePage.TotpCodeRequired'
      : null;
    if (key) {
      this.translate.get(key).subscribe((res: string) => this.messageService.notice(res, 'danger'));
    } else {
      this.messageService.notice(resp?.status?.message);
    }
  }
}
