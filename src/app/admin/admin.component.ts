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
import {AuthenticationService} from '../auth/authentication.service';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
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
  creatingUser = false;

  keychips: any[] = null;
  kcPatternControl = new FormControl('');
  kcCurrentPage = 1;
  kcTotalElements = 0;

  constructor(
    private api: ApiService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private translate: TranslateService,
    private authenticationService: AuthenticationService,
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

  loginAs(username: string){
    this.authenticationService.loginAs(username)
      .subscribe(
        {
          next: (resp) => {
            if (resp?.status) {
              const statusCode: StatusCode = resp.status.code;
              if (statusCode === StatusCode.OK && resp.data) {
                this.messageService.notice(resp.status.message);
                location.reload();
              }
              else if (statusCode === StatusCode.LOGIN_FAILED){
                this.translate.get('SignInPage.LoginFailedMessage').subscribe((res: string) => {
                  this.messageService.notice(res, 'danger');
                });
              }
              else{
                this.messageService.notice(resp.status.message);
              }
            }
          },
          error: (error) => {
            this.messageService.notice(error);
            console.warn('login fail', error);
          }
        }
      );
  }

  refresh() {
    this.load(this.currentPage - 1, this.patternControl.value);
  }

  openUser(item: AdvancedUser, tpl: any) {
    this.selectedProfile = null;
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
