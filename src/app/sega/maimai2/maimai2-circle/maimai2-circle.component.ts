import { Component, OnInit } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { of } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Clipboard } from '@angular/cdk/clipboard';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { UserService } from 'src/app/user.service';
import { Page } from 'src/app/model/Page';
import { ApiResponse, isOk } from 'src/app/model/ApiResponse';
import { DialogService } from 'src/app/dialog.service';
import { Maimai2Circle } from '../model/Maimai2Circle';
import { Maimai2UserCircleInfo } from '../model/Maimai2UserCircleInfo';
import { Maimai2RequestJoinCircleUser } from '../model/Maimai2RequestJoinCircleUser';
import { Maimai2CircleMemberInfo } from '../model/Maimai2CircleMemberInfo';
import { Maimai2Music } from '../model/Maimai2Music';

@Component({
  selector: 'app-maimai2-circle',
  templateUrl: './maimai2-circle.component.html',
  styleUrls: ['./maimai2-circle.component.css']
})
export class Maimai2CircleComponent implements OnInit {

  constructor(
    private api: ApiService,
    private userService: UserService,
    private messageService: MessageService,
    private modalService: NgbModal,
    private dialogService: DialogService,
    protected clipboard: Clipboard,
    private translate: TranslateService
  ) {
  }

  protected readonly Math = Math;
  host = environment.assetsHost;
  enableImages = environment.enableImages;

  aimeId: string;

  requestJoinUserList: Maimai2RequestJoinCircleUser[] = [];
  requestJoinUserListTotalCount = 0;
  requestJoinUserListPage = 0;

  circleMemberUserList: Maimai2CircleMemberInfo[] = [];
  circleMemberUserListTotalCount = 0;
  circleMemberUserListPage = 0;

  publicUserCircleList: Maimai2Circle[] = [];
  publicUserCircleListTotalCount = 0;
  publicUserCircleListPage = 0;

  userCircleInfo: Maimai2UserCircleInfo = null;
  challengeMusic: Maimai2Music = null;

  updateCommentStr: string;

  pageSize = 10;

  isModify = false;
  tmpUserCircle: Maimai2Circle;

  ngOnInit() {
    this.aimeId = String(this.userService.currentUser.defaultCard.extId);
    this.load();
  }

  loadPublicUserCircleList(page: number) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('page', page);
    this.api.get('api/game/maimai2/circle', param).pipe().subscribe(
      (data: Page<Maimai2Circle>) => {
        this.publicUserCircleList = data.content;
        this.publicUserCircleListPage = page;
        this.publicUserCircleListTotalCount = data.totalElements;
        console.log(`loadPublicUserCircleList() loaded successfully, page = ${page}`);
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadPublicUserCircleList() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  loadRequestJoinCircleList(page: number) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('page', page);
    this.api.get('api/game/maimai2/requestJoinCircleList', param).pipe().subscribe(
      (data: Page<Maimai2RequestJoinCircleUser>) => {
        this.requestJoinUserList = data.content;
        this.requestJoinUserListPage = page;
        this.requestJoinUserListTotalCount = data.totalElements;
        console.log(`loadRequestJoinCircleList() loaded successfully, page = ${page}`);
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadRequestJoinCircleList() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  loadCircleMemberUserList(page: number) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('page', page);
    this.api.get('api/game/maimai2/circleMemberUser', param).pipe().subscribe(
      (data: Page<Maimai2CircleMemberInfo>) => {
        this.circleMemberUserList = data.content;
        this.circleMemberUserListPage = page;
        this.circleMemberUserListTotalCount = data.totalElements;
        console.log(`loadCircleMemberUserList() loaded successfully, page = ${page}`);
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadCircleMemberUserList() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  loadUserCircleInfo() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/maimai2/userCircleInfo', param).pipe().subscribe(
      (data: ApiResponse<Maimai2UserCircleInfo>) => {
        if (isOk(data)) {
          this.userCircleInfo = data.data;
          this.updateCommentStr = data.data?.joinedCircle?.comment;
          this.loadChallengeMusic();
          console.log('loadUserCircleInfo() loaded successfully');
        } else {
          this.toastShowFailedMessage(data, 'LoadUserCircleInfoFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadUserCircleInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  copyCircleCode(circle: Maimai2Circle) {
    this.clipboard.copy(circle.circleCode);
    this.messageService.toastService.show(this.t('CopyCircleCodeSuccess'));
  }

  load() {
    this.loadPublicUserCircleList(0);
    this.loadUserCircleInfo();
    this.loadRequestJoinCircleList(0);
    this.loadCircleMemberUserList(0);
  }

  nextRequestJoinCircleListPage() {
    if ((this.requestJoinUserListPage + 1) * this.pageSize < this.requestJoinUserListTotalCount) {
      this.loadRequestJoinCircleList(this.requestJoinUserListPage + 1);
    }
  }

  prevRequestJoinCircleListPage() {
    if (this.requestJoinUserListPage > 0) {
      this.loadRequestJoinCircleList(this.requestJoinUserListPage - 1);
    }
  }

  nextCircleMemberUserListPage() {
    if ((this.circleMemberUserListPage + 1) * this.pageSize < this.circleMemberUserListTotalCount) {
      this.loadCircleMemberUserList(this.circleMemberUserListPage + 1);
    }
  }

  prevCircleMemberUserListPage() {
    if (this.circleMemberUserListPage > 0) {
      this.loadCircleMemberUserList(this.circleMemberUserListPage - 1);
    }
  }

  nextPublicUserCircleListPage() {
    if ((this.publicUserCircleListPage + 1) * this.pageSize < this.publicUserCircleListTotalCount) {
      this.loadPublicUserCircleList(this.publicUserCircleListPage + 1);
    }
  }

  prevPublicUserCircleListPage() {
    if (this.publicUserCircleListPage > 0) {
      this.loadPublicUserCircleList(this.publicUserCircleListPage - 1);
    }
  }

  joinCircle(circle: Maimai2Circle) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('circleId', circle.circleId);
    this.api.post('api/game/maimai2/requestJoinCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(this.t('JoinCircleSuccess'));
        } else {
          this.toastShowFailedMessage(data, 'JoinCircleFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`joinCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  async kickUser(memberInfo: Maimai2CircleMemberInfo) {
    if (!await this.dialogService.show(
      this.t('Warning'),
      this.t('KickUserConfirm', { userName: memberInfo?.userProfile?.userName ?? '' })
    )) {
      return;
    }

    const param = new HttpParams().set('aimeId', this.aimeId).set('userCode', memberInfo?.userCode);
    await this.api.post('api/game/maimai2/deleteUserToCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(this.t('KickUserSuccess'));
          this.loadCircleMemberUserList(this.circleMemberUserListPage);
        } else {
          this.toastShowFailedMessage(data, 'KickUserFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`kickUser() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  approveUser(userCode: string) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('userCode', userCode);
    this.api.post('api/game/maimai2/approveUserJoinCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(this.t('ApproveJoinSuccess'));
          this.loadRequestJoinCircleList(this.requestJoinUserListPage);
          this.loadCircleMemberUserList(this.circleMemberUserListPage);
        } else {
          this.toastShowFailedMessage(data, 'ApproveJoinFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`approveUser() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  rejectUser(userCode: string) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('userCode', userCode);
    this.api.post('api/game/maimai2/rejectUserJoinCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(this.t('RejectJoinSuccess'));
          this.loadRequestJoinCircleList(this.requestJoinUserListPage);
        } else {
          this.toastShowFailedMessage(data, 'RejectJoinFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`rejectUser() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  updateCircle() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.post('api/game/maimai2/updateCircle', this.tmpUserCircle, param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(this.t('UpdateCircleSuccess'));
          this.loadUserCircleInfo();
        } else {
          this.toastShowFailedMessage(data, 'UpdateCircleFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`updateCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  openCreateCircleDialog(content: any) {
    this.isModify = false;
    this.tmpUserCircle = {} as any;
    this.modalService.open(content, { ariaLabelledBy: 'modal-basic-title' });
  }

  openModifyCircleDialog(content: any) {
    this.isModify = true;
    this.tmpUserCircle = JSON.parse(JSON.stringify(this.userCircleInfo.joinedCircle));
    this.modalService.open(content, { ariaLabelledBy: 'modal-basic-title' });
  }

  processComfirmButton() {
    if (this.isModify) {
      this.updateCircle();
    } else {
      this.createCircle();
    }
  }

  createCircle() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.post('api/game/maimai2/createCircle', this.tmpUserCircle, param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(this.t('CreateCircleSuccess'));
          this.loadUserCircleInfo();
        } else {
          this.toastShowFailedMessage(data, 'CreateCircleFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`createCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  async exitCircle() {
    if (!await this.dialogService.show(
      this.t('Warning'),
      this.t('ExitCircleConfirm', { circleName: this.userCircleInfo?.joinedCircle?.circleName ?? '' })
    )) {
      return;
    }

    const param = new HttpParams().set('aimeId', this.aimeId);
    await this.api.post('api/game/maimai2/exitCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(this.t('ExitCircleSuccess'));
          this.loadUserCircleInfo();
        } else {
          this.toastShowFailedMessage(data, 'ExitCircleFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`exitCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  async dissolveCircle() {
    if (!await this.dialogService.show(
      this.t('Warning'),
      this.t('DissolveCircleConfirm', { circleName: this.userCircleInfo?.joinedCircle?.circleName ?? '' })
    )) {
      return;
    }

    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.post('api/game/maimai2/dissolveCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(this.t('DissolveCircleSuccess'));
          this.loadUserCircleInfo();
        } else {
          this.toastShowFailedMessage(data, 'DissolveCircleFailed');
        }
      },
      (error: string) => {
        this.messageService.notice(error);
        console.error(`dissolveCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  toastShowFailedMessage(apiResp: ApiResponse<any>, contentPrefixKey: string) {
    const msg = `${this.t(contentPrefixKey)}: [${apiResp?.status?.code}] ${apiResp?.status?.message}`;
    this.messageService.toastService.show(msg);
  }

  loadChallengeMusic() {
    const musicId = this.getCurrentChallengeMusicId();
    if (!musicId) {
      this.challengeMusic = null;
      return;
    }

    const param = new HttpParams().set('id', musicId);
    this.api.get('api/game/maimai2/data/music', param).pipe().subscribe(
      (data: Maimai2Music) => {
        this.challengeMusic = data;
      },
      (error: string) => {
        this.challengeMusic = null;
        console.error(`loadChallengeMusic() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  formatAchievement(achievement: number | null | undefined) {
    if (achievement === null || achievement === undefined) {
      return this.t('Dash');
    }

    return `${(achievement / 10000).toFixed(4)}%`;
  }

  formatBoolean(value: boolean | null | undefined) {
    if (value === null || value === undefined) {
      return this.t('Dash');
    }

    return value ? this.t('Yes') : this.t('No');
  }

  getAchievementProgressPercent(achievement: number | null | undefined) {
    if (achievement === null || achievement === undefined) {
      return 0;
    }

    return Math.max(0, Math.min((achievement / 10000000) * 100, 100));
  }

  formatRewardStatus(rewardGet: boolean | null | undefined) {
    if (rewardGet === null || rewardGet === undefined) {
      return this.t('Dash');
    }

    return rewardGet ? this.t('Claimed') : this.t('Pending');
  }

  getCurrentChallengeMusicId() {
    return this.userCircleInfo?.circleChallenge?.musicId
      ?? this.userCircleInfo?.userCircleChallenge?.musicId
      ?? 0;
  }

  getChallengeLevelSummary(music: Maimai2Music | null | undefined) {
    if (!music?.details) {
      return '';
    }

    const difficultyLabels = [
      this.t('Basic'),
      this.t('Advanced'),
      this.t('Expert'),
      this.t('Master'),
      this.t('ReMaster'),
      this.t('Utage')
    ];

    return Object.values(music.details)
      .filter(detail => detail)
      .sort((a, b) => a.diff - b.diff)
      .map(detail => `${difficultyLabels[detail.diff] ?? `${this.t('Diff')} ${detail.diff}`} ${(detail.levelDecimal / 10).toFixed(1)}`)
      .join(' / ');
  }

  getJacketId(input: number): string {
    return (input ?? 0).toString().slice(-4).padStart(6, '0');
  }

  imgError(event: Event) {
    (event.target as HTMLImageElement).src = this.host + 'assets/mai2/jacket/UI_Jacket_000000.webp';
  }

  private t(key: string, params?: Record<string, any>) {
    return this.translate.instant(`Maimai2.CirclePage.${key}`, params);
  }
}
