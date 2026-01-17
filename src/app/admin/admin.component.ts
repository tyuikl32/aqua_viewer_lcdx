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

  patternControl = new FormControl('');

  userList: AdvancedUser[];

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
  }

  load(page: number, pattern: string) {
    this.currentPage = page + 1;
    const params: any = {page, size: 12};
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
