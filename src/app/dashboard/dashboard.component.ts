import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {PreloadService} from '../database/preload.service';
import {environment} from '../../environments/environment';
import {ApiService} from '../api.service';
import {Observable} from 'rxjs';
import {MessageService} from '../message.service';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {StatusCode} from '../status-code';
import {Announcement, AnnouncementComponent} from '../announcements/announcement/announcement.component';
import {LanguageService} from '../language.service';
import { HttpParams } from '@angular/common/http';
import {TranslateService} from '@ngx-translate/core';
import {Luid} from '../cards/cards.component';

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class DashboardComponent implements OnInit {
  host = environment.maiAssetsHost;
  totalPreloadTaskCount = 0;
  downloadingPreloadTaskCount = 0;
  completedPreloadTaskCount = 0;
  errorPreloadTaskCount = 0;
  enableImages = environment.enableImages;
  announcement: Announcement;
  announcement2: Announcement;
  loadingAnnouncement = true;
  private announcementRequestsPending = 0;
  loadingDatabase = true;
  loadingProfiles = true;
  profilesError = false;
  checkingUpdateState = 'checking';
  dbVersion = 0;
  currentCard = undefined;
  noCard = false;
  protected mai2Profile;

  constructor(
    private preload: PreloadService,
    private api: ApiService,
    private messageService: MessageService,
    private modalService: NgbModal,
    protected language: LanguageService,
    private translate: TranslateService
  ) {
    this.loadAnnouncements();
  }

  ngOnInit() {
    this.addStatusSubscribe(this.preload.ongekiCardState);
    this.addStatusSubscribe(this.preload.ongekiCharacterState);
    this.addStatusSubscribe(this.preload.ongekiMusicState);
    this.addStatusSubscribe(this.preload.ongekiSkillState);
    this.addStatusSubscribe(this.preload.ongekiTrophyState);
    this.addStatusSubscribe(this.preload.chusanMusicState);
    this.addStatusSubscribe(this.preload.chusanCharacterState);
    this.addStatusSubscribe(this.preload.chusanTrophyState);
    this.addStatusSubscribe(this.preload.chusanNamePlateState);
    this.addStatusSubscribe(this.preload.chusanSystemVoiceState);
    this.addStatusSubscribe(this.preload.chusanMapIconState);
    this.addStatusSubscribe(this.preload.chusanFrameState);
    this.addStatusSubscribe(this.preload.chusanAvatarAccState);
    this.addStatusSubscribe(this.preload.chusanSymbolChatState);
    this.addStatusSubscribe(this.preload.chusanStageState);
    this.addStatusSubscribe(this.preload.maimai2MusicState);
    this.preload.checkingUpdateObservable.subscribe(checkingUpdate => {
      this.checkingUpdateState = checkingUpdate;
    });
    this.preload.dbVersionObservable.subscribe(dbVersion => {
      this.dbVersion = dbVersion;
    });
    this.translate.onLangChange.subscribe(event => {
      this.loadingAnnouncement = true;
      this.loadAnnouncements();
    });

    this.getProfiles();
  }

  getProfiles(){
    this.api.get('api/user/profiles').subscribe(
      resp => {
        if (resp?.status) {
          const statusCode: StatusCode = resp.status.code;
          if (statusCode === StatusCode.OK && resp.data) {
            this.mai2Profile = resp.data.maimai2;
            const accessCode = resp.data.maimai2?.accessCode;
            if (accessCode){
              this.currentCard = new Luid(accessCode).getMaskedValue();
            }
          }
          else if (statusCode === StatusCode.NOT_FOUND){
            this.noCard = true;
          }
          else{
            this.messageService.notice(resp.status.message);
            this.profilesError = true;
          }
        }
        this.loadingProfiles = false;
      },
      error => {
        this.messageService.notice(error);
        this.loadingProfiles = false;
        this.profilesError = true;
      });
  }

  addStatusSubscribe(observable: Observable<string>){
    this.totalPreloadTaskCount++;
    observable.subscribe(data => {this.onStateChanged(data); });
  }

  onStateChanged(data: string) {
    if (data === 'Downloading') {
      this.downloadingPreloadTaskCount++;
    }
    if (data === 'OK') {
      this.completedPreloadTaskCount++;
    }
    if (data === 'Error') {
      this.errorPreloadTaskCount++;
    }
    if (this.completedPreloadTaskCount + this.errorPreloadTaskCount === this.totalPreloadTaskCount) {
      this.loadingDatabase = false;
    }
  }

  reload() {
    this.preload.reload();
  }

  loadAnnouncements() {
    this.announcementRequestsPending = 2;
    const param = new HttpParams().set('lang', this.language.getCurrentLang()).set('index', 0);
    this.api.getLcdx('lcdx/announcement/recent', param).subscribe(
      resp => {
        if (resp?.status) {
          const statusCode: StatusCode = resp.status.code;
          if (statusCode === StatusCode.OK && resp.data) {
            this.announcement = Announcement.fromJSON(resp.data);
          }
          else{
            this.messageService.notice(resp.status.message);
          }
        }
        this.finishAnnouncementRequest();
      },
      error => {
        this.messageService.notice(error);
        this.finishAnnouncementRequest();
      });

    const param2 = new HttpParams().set('lang', this.language.getCurrentLang()).set('index', 1);
    this.api.getLcdx('lcdx/announcement/recent', param2).subscribe(
      resp => {
        if (resp?.status) {
          const statusCode: StatusCode = resp.status.code;
          if (statusCode === StatusCode.OK && resp.data) {
            this.announcement2 = Announcement.fromJSON(resp.data);
          }
          else{
            this.messageService.notice(resp.status.message);
          }
        }
        this.finishAnnouncementRequest();
      },
      error => {
        this.messageService.notice(error);
        this.finishAnnouncementRequest();
      });
  }

  private finishAnnouncementRequest() {
    this.announcementRequestsPending--;
    this.loadingAnnouncement = this.announcementRequestsPending > 0;
  }

  showAnnouncement(announcement: Announcement) {
    const modalRef = this.modalService.open(AnnouncementComponent, {scrollable: true, centered: true});
    modalRef.componentInstance.announcement = announcement;
  }

  getFormattedNumberByDigit(input: string, digit: number): string {
    return input.toString().padStart(digit, '0');
  }

}

