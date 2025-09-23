import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { HttpParams } from '@angular/common/http';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { environment } from '../../../../environments/environment';
import { catchError, map, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { UserService } from 'src/app/user.service';
import { Maimai2Circle } from '../model/Maimai2Circle';
import { Page } from 'src/app/model/Page';
import { error } from 'console';
import { ApiResponse } from 'src/app/model/ApiResponse';
import { Maimai2UserCircleInfo } from '../model/Maimai2UserCircleInfo';
import { Maimai2RequestJoinCircleUser } from '../model/Maimai2RequestJoinCircleUser';
import { Maimai2UserCircleData } from '../model/Maimai2UserCircleData';
import { Maimai2CircleMemberInfo } from '../model/Maimai2CircleMemberInfo';
import { Clipboard } from '@angular/cdk/clipboard';
import { json } from 'stream/consumers';

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
        this.userCircleInfo = data.data;
        this.updateCommentStr = data.data?.joinedCircle?.comment;
        console.log(`loadUserCircleInfo() loaded successfully`);
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
        if (data.data)
          this.messageService.toastService.show("申请加入Circle成功, 等待对方同意");
        else
          this.messageService.toastService.show("申请加入Circle失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`joinCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  kickUser(userCode: string) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('userCode', userCode);
    this.api.post('api/game/maimai2/deleteUserToCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (data.data) {
          this.messageService.toastService.show("踢出玩家成功");
          //refresh
          this.loadCircleMemberUserList(this.circleMemberUserListPage);
        }
        else
          this.messageService.toastService.show("踢出玩家失败");
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
        if (data.data) {
          this.messageService.toastService.show("同意玩家加入Circle成功");
          //refresh
          this.loadRequestJoinCircleList(this.requestJoinUserListPage);
          this.loadCircleMemberUserList(this.circleMemberUserListPage);
        }
        else
          this.messageService.toastService.show("同意玩家加入Circle失败");
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
        if (data.data) {
          this.messageService.toastService.show("已拒绝玩家加入Circle");
          //refresh
          this.loadRequestJoinCircleList(this.requestJoinUserListPage);
        }
        else
          this.messageService.toastService.show("拒绝玩家加入Circle失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`rejectUser() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  setIsPublic(isPublic: boolean) {
    let copyCircle: Maimai2Circle = JSON.parse(JSON.stringify(this.userCircleInfo.joinedCircle));
    copyCircle.isPublic = isPublic;

    this.updateCircle(copyCircle);
  }

  updateComment() {
    let copyCircle: Maimai2Circle = JSON.parse(JSON.stringify(this.userCircleInfo.joinedCircle));
    copyCircle.comment = this.updateCommentStr;

    this.updateCircle(copyCircle);
  }

  updateCircle(circle: Maimai2Circle) {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.post('api/game/maimai2/updateCircle', circle, param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (data.data) {
          this.messageService.toastService.show("更新Circle信息成功");
          this.loadUserCircleInfo(); // refresh
        }
        else
          this.messageService.toastService.show("更新Circle信息失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`updateCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  exitCircle() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.post('api/game/maimai2/exitCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (data.data) {
          this.messageService.toastService.show("退出Circle成功");
          this.loadUserCircleInfo(); // refresh
        }
        else
          this.messageService.toastService.show("退出Circle失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`exitCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  dissolveCircle() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.post('api/game/maimai2/dissolveCircle', param).pipe().subscribe(
      (data: ApiResponse<boolean>) => {
        if (data.data) {
          this.messageService.toastService.show("解散Circle成功");
          this.loadUserCircleInfo(); // refresh
        }
        else
          this.messageService.toastService.show("解散Circle失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`dissolveCircle() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  protected readonly length = length;
}
