import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {ApiService} from '../../../api.service';
import {MessageService} from '../../../message.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import {DisplayMaimai2Profile} from '../model/Maimai2Profile';
import { Maimai2UploadUserPortraitDialog } from './maimai2-upload-user-portrait/maimai2-upload-user-portrait.dialog';
import {environment} from '../../../../environments/environment';
import { UserService } from 'src/app/user.service';
import {AccountService} from '../../../auth/account.service';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {StatusCode} from '../../../status-code';
import {Time} from '@angular/common';
import {TranslateService} from '@ngx-translate/core';

@Component({
    selector: 'app-maimai2-setting',
    templateUrl: './maimai2-setting.component.html',
    styleUrls: ['./maimai2-setting.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class Maimai2SettingComponent implements OnInit {

  profile: DisplayMaimai2Profile;
  userNameForm: FormGroup;
  redeemCodeForm: FormGroup;
  bindCardForm: FormGroup;

  currentAccessCode = '';
  mergeRequested = false;
  mergeRequestLoading = false;
  mergeCardId = '';
  mergeLastRequestDate: string | null = null;
  mergeLastSuccessDate: string | null = null;
  aimeId: number;
  apiServer: string;
  divMaxLength: number;

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private accountService: AccountService,
    private http: HttpClient,
    protected userService: UserService,
    private messageService: MessageService,
    private translate: TranslateService,
  ) {
    this.userNameForm = this.fb.group({
      username: [''],
    });
    this.redeemCodeForm = this.fb.group({
      redeemCode: [''],
    });
    this.bindCardForm = this.fb.group({
      accessCode: ['', [
        Validators.required,
        Validators.minLength(20),
        Validators.maxLength(20)]]
    });
  }

  get userNameInput() {
    return this.userNameForm.get('username');
  }

  get redeemCodeInput() {
    return this.redeemCodeForm.get('redeemCode');
  }

  get accessCodeInput() {
    return this.bindCardForm.get('accessCode');
  }

  ngOnInit(): void {
    this.aimeId = this.userService.currentUser.defaultCard.extId;
    this.mergeCardId = String(this.userService.currentUser.defaultCard.luid ?? '');
    this.apiServer = environment.apiServer;
    this.bindCardForm.disable();
    this.bindCardForm.setValue({accessCode : '请稍后'});
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/maimai2/profile', param).subscribe(
      data => {
        this.profile = data;
        this.userNameForm.setValue({username: data.userName});
      },
      error => this.messageService.notice(error)
    );

    this.api.get('api/game/maimai2/config/userPhoto/divMaxLength').subscribe(divMaxLength => {
      this.divMaxLength = divMaxLength;
    });

    this.api.getLcdx('lcdx/getBindAccessCode/' + this.userService.currentUser.cards[0].luid).subscribe(
      data => {
        this.currentAccessCode = data.data;
        this.bindCardForm.setValue({accessCode : data.data});
        if (data.data !== ''){
          this.bindCardForm.disable();
        }else{
          this.bindCardForm.enable();
        }
      }
    );

    this.loadMergeRequestStatus();
  }

  private loadMergeRequestStatus() {
    if (!this.mergeCardId) {
      return;
    }

    const userName = encodeURIComponent(this.userService.currentUser.username);
    const cardId = encodeURIComponent(this.mergeCardId);
    this.api.getLcdx(`lcdx/mergeRegistry/${userName}/${cardId}`).subscribe(
      data => {
        if (data?.status?.code === StatusCode.OK) {
          this.mergeRequested = data.data?.isOnRequest === true;
          this.mergeLastRequestDate = this.normalizeMergeDate(data.data?.lastRequestDate);
          this.mergeLastSuccessDate = this.normalizeMergeDate(data.data?.lastSuccessDate);
        }
      },
      error => this.messageService.notice(error)
    );
  }

  private normalizeMergeDate(value: any): string | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    // 后端无记录时返回 DateTime 默认值 0001-01-01，视为无记录
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
      return null;
    }
    return date.toLocaleString();
  }

  requestMergeFromDefaultServer() {
    if (this.mergeRequestLoading || this.mergeRequested || !this.mergeCardId) {
      return;
    }

    if (!confirm(this.translate.instant('Maimai2.Setting.MergeRequestConfirm'))) {
      return;
    }

    this.mergeRequestLoading = true;
    const userName = encodeURIComponent(this.userService.currentUser.username);
    const cardId = encodeURIComponent(this.mergeCardId);
    this.api.postLcdx(`lcdx/mergeRegistry/request/${userName}/${cardId}`).subscribe(
      data => {
        this.mergeRequestLoading = false;
        if (data?.status?.code === StatusCode.OK) {
          this.mergeRequested = true;
          this.messageService.notice(data.status.message);
        } else {
          this.messageService.notice(data?.status?.message ?? '设置引继请求失败');
        }
      },
      error => {
        this.mergeRequestLoading = false;
        this.messageService.notice(error);
      }
    );
  }

  cancelMergeRequest() {
    if (this.mergeRequestLoading || !this.mergeRequested || !this.mergeCardId) {
      return;
    }

    if (!confirm(this.translate.instant('Maimai2.Setting.MergeCancelConfirm'))) {
      return;
    }

    this.mergeRequestLoading = true;
    const userName = encodeURIComponent(this.userService.currentUser.username);
    const cardId = encodeURIComponent(this.mergeCardId);
    this.api.postLcdx(`lcdx/mergeRegistry/cancel/${userName}/${cardId}`).subscribe(
      data => {
        this.mergeRequestLoading = false;
        if (data?.status?.code === StatusCode.OK) {
          this.mergeRequested = false;
          this.messageService.notice(this.translate.instant('Maimai2.Setting.MergeCancelSuccess'));
        } else {
          this.messageService.notice(this.translate.instant('Maimai2.Setting.MergeCancelFailed'));
        }
      },
      error => {
        this.mergeRequestLoading = false;
        this.messageService.notice(this.translate.instant('Maimai2.Setting.MergeCancelFailed'));
      }
    );
  }

  onSubmit() {

  }

  userName() {
    if (this.userNameForm.touched) {
      this.api.post('api/game/maimai2/profile/username', {aimeId: this.aimeId, userName: this.userNameInput.value}).subscribe(
        x => {
          this.profile = x;
          this.messageService.notice('Successfully changed');
        }, error => this.messageService.notice(error)
      );
    }

  }

  activateRedeemCode() {
    if (this.redeemCodeForm.touched) {
      const param = new HttpParams().set('aimeId', this.aimeId).set('redeemCode', this.redeemCodeInput.value);
      this.api.get('api/game/maimai2/redeem', param).subscribe(
        x => {
          if (x.status.code === 92001) {
            this.messageService.notice('Successfully activated ' + x.data);
          } else {
            this.messageService.notice(x.data);
          }
        }, error => this.messageService.notice(error)
      );
    }

  }

  openUploadUserPortraitDialog() {
    this.messageService.notice('根据《中华人民共和国个人信息保护法》，该功能已关闭', 'warning');
    /// const modalRef = this.modalService.open(Maimai2UploadUserPortraitDialog, {scrollable: true, centered: true});
    /// modalRef.componentInstance.aimeId = String(this.userService.currentUser.defaultCard.extId);
    /// modalRef.componentInstance.divMaxLength = this.divMaxLength;
  }

  downloadFile() {
    const url = this.apiServer + 'api/game/maimai2/export?aimeId=' + this.aimeId;
    const headers = {Authorization: `Bearer ${this.accountService.currentAccountValue.accessToken}`};
    this.http.get(url, {headers, responseType: 'blob'}).subscribe(blob => {
      const objUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `maimai2_${this.aimeId}_exported.json`;
      a.click();
      document.body.appendChild(a);
      document.body.removeChild(a);

      window.URL.revokeObjectURL(objUrl);
    });
  }

  lcdxBindAccessCode(){
    if (this.currentAccessCode !== ''){
      const body = {currentAccessCode : this.userService.currentUser.cards[0].luid};
      this.api.postLcdx('lcdx/removeAccessCode/' + this.userService.currentUser.username, body).subscribe(
        x => {
          if (x.status.code === 92001) {
            this.messageService.notice(x.status.message);
            location.reload();
          } else {
            this.messageService.notice(x.data);
          }
        }, error => this.messageService.notice(error)
      );
    }
    if (this.bindCardForm.touched && this.bindCardForm.valid) {
      const body = { currentAccessCode : this.userService.currentUser.cards[0].luid , accessCode : this.accessCodeInput.value };
      this.api.postLcdx('lcdx/addAccessCode/' + this.userService.currentUser.username, body).subscribe(
        x => {
          if (x.status.code === 92001) {
            this.messageService.notice(x.status.message);
            location.reload();
          } else {
            this.messageService.notice(x.data);
          }
        }, error => this.messageService.notice(error)
      );
    }
  }
}
