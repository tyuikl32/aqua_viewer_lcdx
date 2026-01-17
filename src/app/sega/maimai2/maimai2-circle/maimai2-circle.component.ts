import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { HttpParams } from '@angular/common/http';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { environment } from '../../../../environments/environment';
import { catchError, map, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { NgbModal, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { UserService } from 'src/app/user.service';
import { Maimai2Circle } from '../model/Maimai2Circle';
import { Page } from 'src/app/model/Page';
import { error } from 'console';
import { ApiResponse, isOk } from 'src/app/model/ApiResponse';
import { Maimai2UserCircleInfo } from '../model/Maimai2UserCircleInfo';
import { Maimai2RequestJoinCircleUser } from '../model/Maimai2RequestJoinCircleUser';
import { Maimai2UserCircleData } from '../model/Maimai2UserCircleData';
import { Maimai2CircleMemberInfo } from '../model/Maimai2CircleMemberInfo';
import { Clipboard } from '@angular/cdk/clipboard';
import { json } from 'stream/consumers';
import { DialogService } from 'src/app/dialog.service';

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
    protected clipboard: Clipboard
  ) {
  }
  protected readonly Math = Math;
  host = environment.assetsHost;
  enableImages = environment.enableImages;

  aimeId: string;

  requestJoinUserList: Maimai2RequestJoinCircleUser[] = [];
  requestJoinUserListTotalCount: number = 0;
  requestJoinUserListPage: number = 0;

  circleMemberUserList: Maimai2CircleMemberInfo[] = [];
  circleMemberUserListTotalCount: number = 0;
  circleMemberUserListPage: number = 0;

  publicUserCircleList: Maimai2Circle[] = [];
  publicUserCircleListTotalCount: number = 0;
  publicUserCircleListPage: number = 0;

  userCircleInfo: Maimai2UserCircleInfo = null;

  updateCommentStr: string;

  pageSize: number = 10

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
      }
      ,
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
      }
      ,
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
      }
      ,
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
          console.log(`loadUserCircleInfo() loaded successfully`);
        } else {
          this.toastShowFailedMessage(data, "加载用户Circle信息失败");
        }
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadUserCircleInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  copyCircleCode(circle: Maimai2Circle) {
    this.clipboard.copy(circle.circleCode);
    this.messageService.toastService.show("复制circleCode成功, 可以给其他人搜索并加入Circle");
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
        if (isOk(data))
          this.messageService.toastService.show("申请加入Circle成功, 等待对方同意");
        else
          this.toastShowFailedMessage(data, "申请加入Circle失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`joinCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  async kickUser(memberInfo: Maimai2CircleMemberInfo) {
    if (!await this.dialogService.show("警告", `是否踢出用户${memberInfo?.userProfile?.userName}?`))
      return;

    const param = new HttpParams().set('aimeId', this.aimeId).set('userCode', memberInfo?.userCode);
    await this.api.post('api/game/maimai2/deleteUserToCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show("踢出玩家成功");
          //refresh
          this.loadCircleMemberUserList(this.circleMemberUserListPage);
        }
        else
          this.toastShowFailedMessage(data, "踢出玩家失败");
      }
      ,
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
          this.messageService.toastService.show("同意玩家加入Circle成功");
          //refresh
          this.loadRequestJoinCircleList(this.requestJoinUserListPage);
          this.loadCircleMemberUserList(this.circleMemberUserListPage);
        }
        else
          this.toastShowFailedMessage(data, "同意玩家加入Circle失败");
      }
      ,
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
          this.messageService.toastService.show("已拒绝玩家加入Circle");
          //refresh
          this.loadRequestJoinCircleList(this.requestJoinUserListPage);
        }
        else
          this.toastShowFailedMessage(data, "拒绝玩家加入Circle失败");
      }
      ,
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
          this.messageService.toastService.show("更新Circle信息成功");
          this.loadUserCircleInfo(); // refresh
        }
        else
          this.toastShowFailedMessage(data, "更新Circle信息失败");
      }
      ,
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
    if (this.isModify)
      this.updateCircle();
    else
      this.createCircle();
  }

  createCircle() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.post('api/game/maimai2/createCircle', this.tmpUserCircle, param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show("新建Circle成功");
          this.loadUserCircleInfo(); // refresh
        }
        else
          this.toastShowFailedMessage(data, "新建Circle失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`createCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  async exitCircle() {
    if (!await this.dialogService.show("警告", `是否退出Circle圈子${this.userCircleInfo?.joinedCircle?.circleName}?`))
      return;
    const param = new HttpParams().set('aimeId', this.aimeId);
    await this.api.post('api/game/maimai2/exitCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show("退出Circle成功");
          this.loadUserCircleInfo(); // refresh
        }
        else
          this.toastShowFailedMessage(data, "退出Circle失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`exitCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  async dissolveCircle() {
    if (!await this.dialogService.show("警告", `是否解散Circle圈子${this.userCircleInfo?.joinedCircle?.circleName}?`))
      return;
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.post('api/game/maimai2/dissolveCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show("解散Circle成功");
          this.loadUserCircleInfo(); // refresh
        }
        else
          this.toastShowFailedMessage(data, "解散Circle失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`dissolveCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  toastShowFailedMessage(apiResp: ApiResponse<any>, contentPrefix: string) {
    var msg = `${contentPrefix}: [${apiResp?.status?.code}] ${apiResp?.status?.message}`;
    this.messageService.toastService.show(msg);
  }

  protected readonly length = length;
}
