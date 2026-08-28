import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { OngekiRival } from '../model/OngekiRival';
import { HttpParams } from '@angular/common/http';
import { AuthenticationService } from '../../../auth/authentication.service';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { environment } from '../../../../environments/environment';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {StatusCode} from '../../../status-code';
import { UserService } from 'src/app/user.service';

@Component({
    selector: 'app-ongeki-rival-list',
    templateUrl: './ongeki-rival-list.component.html',
    styleUrls: ['./ongeki-rival-list.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})

export class OngekiRivalListComponent implements OnInit {
  host = environment.assetsHost;
  rivalList: OngekiRival[] = [];
  myProfile: OngekiRival;
  loadingProfile = true;
  loadingRival = true;

  inputAddRivalUserId = '';

  constructor(
    private dbService: NgxIndexedDBService,
    private api: ApiService,
    private modalService: NgbModal,
    protected userService: UserService,
    private messageService: MessageService,
  ) {
  }

  ngOnInit() {

    this.api.get('api/game/ongeki/rival').subscribe(
      this.refreshFrom.bind(this),
      error => {
        this.messageService.noticeTranslated('Ongeki.RivalListPage.LoadFailed');
        this.loadingRival = false;
      }
    );

    this.api.get(`api/game/ongeki/rival/${10000000 + this.userService.currentUser.defaultCard.id}`).subscribe(
      (data: OngekiRival) => {
        this.myProfile = data;
        this.loadingProfile = false;
      },
      (error) => {
        this.messageService.noticeError();
        this.loadingProfile = false;
      }
    );
  }

  refreshFrom(rivalList: OngekiRival[]) {
    this.rivalList = rivalList;
    console.log(rivalList);
    this.loadingRival = false;
  }

  removeRival(rivalUserId: number) {
    const param = new HttpParams().set('rivalUserId', rivalUserId);
    this.api.delete(`api/game/ongeki/rival`, param).subscribe(
      () => {
        const newList = this.rivalList.filter(item => item.rivalUserId !== rivalUserId);
        this.messageService.noticeTranslated('Ongeki.RivalListPage.DeleteSuccess', null, {id: rivalUserId});
        this.refreshFrom(newList);
      },
      error => this.messageService.noticeTranslated('Ongeki.RivalListPage.DeleteFailed')
    );
  }

  addRival() {
    const param = new HttpParams().set('rivalUserId', (Number).parseInt(this.inputAddRivalUserId));
    this.api.post(`api/game/ongeki/rival`, param).subscribe(
      (data) => {
        if (data?.status) {
          const statusCode: StatusCode = data.status.code;
          if (statusCode === StatusCode.OK && data.data) {
            this.rivalList.push(data.data);
            this.refreshFrom(this.rivalList);
            this.messageService.noticeTranslated('Ongeki.RivalListPage.AddSuccess', null, {id: data.data.rivalUserId});
          }
          else if (statusCode === StatusCode.RIVAL_SELF){
            this.messageService.noticeTranslated('Ongeki.RivalListPage.CannotAddSelf', 'danger');
          }
          else if (statusCode === StatusCode.RIVAL_ALREADY_ADDED){
            this.messageService.noticeTranslated('Ongeki.RivalListPage.AlreadyAdded', 'danger');
          }
          else if (statusCode === StatusCode.RIVAL_NOTFOUND){
            this.messageService.noticeTranslated('Ongeki.RivalListPage.NotFound', 'danger');
          }
          else{
            this.messageService.noticeTranslated('Ongeki.RivalListPage.AddFailed', 'danger');
          }
        }
      },
      error => this.messageService.noticeTranslated('Ongeki.RivalListPage.AddFailed')
    );
  }

  open(content) {
    this.modalService.open(content, {centered: true});
  }
}
