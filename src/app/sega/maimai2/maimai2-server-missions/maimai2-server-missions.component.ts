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
import { Maimai2UserServerMissionPointInfoResp } from '../model/Maimai2UserServerMissionPointInfoResp';
import { Maimai2ServerMissionUserPointChangelog } from '../model/Maimai2ServerMissionUserPointChangelog';
import { Maimai2UserServerMissionInfoResp } from '../model/Maimai2UserServerMissionInfoResp';
import { Maimai2ServerMissionRefreshCycle, Maimai2ServerMissionUserInfo } from '../model/Maimai2ServerMissionUserInfo';
import { Maimai2ServerMissionUserPointData } from '../model/Maimai2ServerMissionUserPointData';
import { Maimai2PointExchangesComponent } from '../maimai2-point-exchanges/maimai2-point-exchanges.component';

@Component({
  selector: 'app-maimai2-server-missions',
  templateUrl: './maimai2-server-missions.component.html',
  styleUrls: ['./maimai2-server-missions.component.css']
})
export class Maimai2ServerMissionsComponent implements OnInit {

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

  pageSize: number = 10;

  hideCompleted: boolean = false;

  userPointChangelogList: Maimai2ServerMissionUserPointChangelog[] = [];
  userPointChangelogListTotalCount: number = 0;
  userPointChangelogListPage: number = 0;

  userPointData: Maimai2ServerMissionUserPointData;

  userServerMissionInfoList: Maimai2ServerMissionUserInfo[] = [];
  filterUserServerMissionInfoList: Maimai2ServerMissionUserInfo[] = [];

  ngOnInit() {
    this.aimeId = String(this.userService.currentUser.defaultCard.extId);
    this.load();
  }

  load() {
    this.loadUserPointsInfo();
    this.loadUserServerMissionInfo();
  }

  getRefreshSCycleOrderValue(cycle: Maimai2ServerMissionRefreshCycle): number {
    switch (cycle) {
      case Maimai2ServerMissionRefreshCycle.EveryDay:
        return 1;
      case Maimai2ServerMissionRefreshCycle.EveryWeek:
        return 2;
      case Maimai2ServerMissionRefreshCycle.EveryMonth:
        return 3;
      default:
        return 99;
    }
  }

  updateFilterUserServerMissionInfoList() {
    this.filterUserServerMissionInfoList = this.hideCompleted ? this.userServerMissionInfoList.filter(m => !this.isMissionCompleted(m)) : this.userServerMissionInfoList;
    if (this.filterUserServerMissionInfoList && this.filterUserServerMissionInfoList.length > 0)
      this.filterUserServerMissionInfoList = this.filterUserServerMissionInfoList.sort((a, b) => {
        //先按刷新周期分类
        var order = this.getRefreshSCycleOrderValue(a.refreshCycle) - this.getRefreshSCycleOrderValue(b.refreshCycle);
        if (order != 0)
          return order;
/*
        //再按任务状态分类，未完成的在前面
        order = Number(this.isMissionCompleted(a)) - Number(this.isMissionCompleted(b));
        if (order != 0)
          return order;
*/
        //最后按任务标题排序
        order = a.missionTitle.localeCompare(b.missionTitle);
        return order;
      });
  }

  loadUserPointsInfo(page: number = 0) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('page', page).set('size', this.pageSize);
    this.api.get('api/game/maimai2/userServerMissionPointInfo', param).pipe().subscribe(
      (data: ApiResponse<Maimai2UserServerMissionPointInfoResp>) => {
        if (isOk(data)) {
          this.userPointChangelogList = data.data.filterPointChangelogs;
          this.userPointChangelogListPage = page;
          this.userPointChangelogListTotalCount = data.data.changelogTotalCount;

          this.userPointData = data.data.userPointData;
        }
        else
          this.toastShowFailedMessage(data, "获取玩家任务点数信息失败");
        console.log(`loadUserPointsInfo() loaded successfully, page = ${page}`);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadUserPointsInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  loadUserServerMissionInfo() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/maimai2/userServerMissionInfo', param).pipe().subscribe(
      (data: ApiResponse<Maimai2UserServerMissionInfoResp>) => {
        if (isOk(data)) {
          this.userServerMissionInfoList = data.data.serverMissionUserInfos;
          this.updateFilterUserServerMissionInfoList();
        }
        else
          this.toastShowFailedMessage(data, "获取玩家任务列表失败");
        console.log(`loadUserServerMissionInfo() loaded successfully`);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadUserServerMissionInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  isMissionCompleted(mission: Maimai2ServerMissionUserInfo): boolean {
    for (let pointChangelog of mission.conditionProgresses) {
      if (!pointChangelog.isDone)
        return false;
    }
    return true;
  }

  getRefreshCycleText(cycle: Maimai2ServerMissionRefreshCycle): string {
    switch (cycle) {
      case Maimai2ServerMissionRefreshCycle.None:
        return '永久';
      case Maimai2ServerMissionRefreshCycle.EveryDay:
        return '每日刷新';
      case Maimai2ServerMissionRefreshCycle.EveryWeek:
        return '每周刷新';
      case Maimai2ServerMissionRefreshCycle.EveryMonth:
        return '每月刷新';
      default:
        return cycle;
    }
  }

  openExchangeModal() {
    const modalRef = this.modalService.open(Maimai2PointExchangesComponent, {
      size: 'xl',
      centered: true,
      scrollable: false,
      backdrop: 'static',
      windowClass: 'maimai2-exchange-modal'
    });

    modalRef.dismissed.subscribe(
      (result) => {
        this.load();
      }
    );
  }

  toastShowFailedMessage(apiResp: ApiResponse<any>, contentPrefix: string) {
    var msg = `${contentPrefix}: [${apiResp?.status?.code}] ${apiResp?.status?.message}`;
    this.messageService.toastService.show(msg);
  }

  protected readonly length = length;
}
