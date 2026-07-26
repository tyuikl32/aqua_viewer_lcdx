import {MessageService} from 'src/app/message.service';
import {Component, OnInit} from '@angular/core';
import {UserService} from '../user.service';
import {OAuthService} from '../auth/oauth.service';
import {WebAuthnService} from '../auth/webauthn.service';
import {ApiService} from '../api.service';
import {StatusCode} from '../status-code';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import * as bootstrap from 'bootstrap';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
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

  constructor(
    protected oAuthService: OAuthService,
    protected userService: UserService,
    private webAuthn: WebAuthnService,
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

  link(){
    const params = {
      token: this.token
    }
    this.api.post(`api/user/oauth2`, params).subscribe(
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
          this.messageService.notice('Link failed.');
        }
      },
      error => {
        this.messageService.notice(error);
      },
      ()=>{
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

  async onAddPasskey(nick: string){
    if (this.addingPasskey) {
      return;
    }
    this.addingPasskey = true;
    try {
      const resp = await this.webAuthn.register(nick?.trim() ? nick.trim() : 'Passkey');
      if (resp?.status?.code === StatusCode.OK) {
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
}
