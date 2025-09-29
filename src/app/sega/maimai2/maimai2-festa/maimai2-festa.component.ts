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
import { Maimai2GameFestaInfo } from '../model/Maimai2GameFestaInfo';
import { Maimai2UserFestaInfo } from '../model/Maimai2UserFestaInfo';
import { Maimai2GameFesta } from '../model/Maimai2GameFesta';
import { Maimai2UserFestaData } from '../model/Maimai2UserFestaData';
import { Maimai2CircleFestaRankInfo } from '../model/Maimai2CircleFestaRankInfo';
import { Maimai2CircleFestaData } from '../model/Maimai2CircleFestaData';

@Component({
  selector: 'app-maimai2-festa',
  templateUrl: './maimai2-festa.component.html',
  styleUrls: ['./maimai2-festa.component.css']
})
export class Maimai2FestaComponent implements OnInit {

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

  gameFestaInfo: Maimai2GameFestaInfo = null;
  userFestaInfo: Maimai2UserFestaInfo = null;
  userResultFestaInfo: Maimai2UserFestaInfo = null;
  userCircleInfo: Maimai2UserCircleInfo = null;

  sameSideCircleRankInfoList: Maimai2CircleFestaRankInfo[] = null;
  isShowSameSideWithoutPlaceIdFilter = false;

  allSideCircleRankInfoList: Maimai2CircleFestaRankInfo[] = null;
  isShowAllSideWithoutPlaceIdFilter = false;

  ngOnInit() {
    this.aimeId = String(this.userService.currentUser.defaultCard.extId);
    this.load();
  }

  load() {
    this.loadUserCircleInfo();
    this.loadGameFestaInfo();
  }

  loadUserCircleInfo() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/maimai2/userCircleInfo', param).pipe().subscribe(
      (data: ApiResponse<Maimai2UserCircleInfo>) => {
        this.userCircleInfo = data.data;
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

  loadSameSideCircleRankInfo(userFestaData: Maimai2UserFestaData) {
    const param = new HttpParams()
      .set('aimeId', this.aimeId)
      .set('openEventId', userFestaData.eventId)
      .set('filterFestaSideId', userFestaData.festaSideId)
      .set('placeId', this.isShowSameSideWithoutPlaceIdFilter ? -1 : userFestaData.placeId)
      .set('page', 0)
      .set('size', 10);

    this.api.get('api/game/maimai2/rankFestaCircles', param).pipe().subscribe(
      (data: Page<Maimai2CircleFestaRankInfo>) => {
        this.sameSideCircleRankInfoList = data.content;
        console.log(`loadSameSideCircleRankInfo() loaded successfully`);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadSameSideCircleRankInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  loadAllSideCircleRankInfo(userFestaData: Maimai2UserFestaData) {
    const param = new HttpParams()
      .set('aimeId', this.aimeId)
      .set('openEventId', userFestaData.eventId)
      .set('filterFestaSideId', -1)
      .set('placeId', this.isShowAllSideWithoutPlaceIdFilter ? -1 : userFestaData.placeId)
      .set('page', 0)
      .set('size', 10);

    this.api.get('api/game/maimai2/rankFestaCircles', param).pipe().subscribe(
      (data: Page<Maimai2CircleFestaRankInfo>) => {
        this.allSideCircleRankInfoList = data.content;
        console.log(`loadSameSideCircleRankInfo() loaded successfully`);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadSameSideCircleRankInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  getEventStartTimeString(openEventId: string) {
    let year = parseInt(openEventId.substring(0, 2), 10);
    let month = parseInt(openEventId.substring(2, 4), 10) - 1;
    let day = parseInt(openEventId.substring(4, 6), 10);

    let result = new Date(new Date(2000 + year, month, day).getTime() + 7 * 24 * 60 * 60 * 1000);
    return `${result.getFullYear()}-${(result.getMonth() + 1).toString().padStart(2, '0')}-${result.getDate().toString().padStart(2, '0')}`;
  }

  loadGameFestaInfo() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/maimai2/gameFestaInfo', param).pipe().subscribe(
      async (data: ApiResponse<Maimai2GameFestaInfo>) => {
        this.gameFestaInfo = data.data;
        console.log(`loadGameFestaInfo() loaded successfully`);

        if (this.gameFestaInfo.gameFesta) {
          this.userFestaInfo = await this.loadUserFestaInfo(this.gameFestaInfo.gameFesta);
          if (this.userFestaInfo.userFestaData) {
            this.loadSameSideCircleRankInfo(this.userFestaInfo.userFestaData);
            this.loadAllSideCircleRankInfo(this.userFestaInfo.userFestaData);
          }
        }
        if (this.gameFestaInfo.gameRsultFesta)
          this.userResultFestaInfo = await this.loadUserFestaInfo(this.gameFestaInfo.gameRsultFesta);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadGameFestaInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  loadUserFestaInfo(gameFesta: Maimai2GameFesta) {
    return new Promise<Maimai2UserFestaInfo>(resolve => {
      const param = new HttpParams().set('aimeId', this.aimeId).set('relativeEventId', gameFesta.openEventId);
      this.api.get('api/game/maimai2/userFestaInfo', param).pipe().subscribe(
        (data: ApiResponse<Maimai2UserFestaInfo>) => {
          resolve(data.data);
          console.log(`loadUserFestaInfo() loaded successfully`);
        }
        ,
        (error: string) => {
          this.messageService.notice(error);
          console.error(`loadUserFestaInfo() failed, error = ${error}`);
          resolve(null);
          return of({ data: [], error: true });
        }
      );
    })
  }

  voteSide(openEventId: string, festaSideId: number) {
    const param = new HttpParams().set('aimeId', this.aimeId).set('openEventId', openEventId).set('festaSideId', festaSideId);
    this.api.get('api/game/maimai2/voteSide', param).pipe().subscribe(
      async (data: ApiResponse<boolean>) => {
        if (data.data) {
          this.messageService.toastService.show("队伍投票成功");

          if (this.gameFestaInfo.gameFesta)
            this.userFestaInfo = await this.loadUserFestaInfo(this.gameFestaInfo.gameFesta);
        }
        else
          this.messageService.toastService.show("队伍投票失败");
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadUserFestaInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  getSideName(festa: Maimai2GameFesta, festaSideId: number) {
    return festa["festaSide" + festaSideId.toString().padStart(2, "0")];
  }

  getEventTimeString(str: string) {
    if (str?.length < 6)
      return `<unk_time:${str}>`
    let year = "20" + str.substring(0, 2); // "27" → "2027"
    let month = str.substring(2, 4);       // "12"
    let day = str.substring(4, 6);         // "30"

    return `${year}-${month}-${day}`;
  }

  getFestaSideColor(festaSideId: number) {
    const colors = ['#F6377A', '#3F67F0', '#34C91B'];
    return colors[(festaSideId - 1) % colors.length];
  }


  getStatePhaseColor(phase: string) {
    switch (phase.toLocaleLowerCase()) {
      case 'init':
        return 'lightgray';
      case 'voteteam':
        return 'orange';
      case 'started':
        return 'green';
      case 'finished':
        return 'red';
    }
  }

  getStatePhaseName(phase: string) {
    switch (phase.toLocaleLowerCase()) {
      case 'init':
        return '未开催';
      case 'voteteam':
        return '投票选队中';
      case 'started':
        return '已开始';
      case 'finished':
        return '已结束';
    }
  }

  getFestaStatePhaseBackgroundColor(festaStatePhase: string) {
    festaStatePhase = festaStatePhase.toLocaleLowerCase();
    switch (festaStatePhase) {
      case "finished": "已结束"
    }
  }

  formatRank(rank: number) {
    if (rank == 0)
      return "--";

    var postfix = "th";
    switch (rank) {
      case 1: { postfix = "st"; break; };
      case 2: { postfix = "nd"; break; };
      case 3: { postfix = "rd"; break; };
    }

    return rank.toString() + postfix;
  }

  getVotedFestaSideId() {
    return this.userFestaInfo?.userFestaData?.festaSideId ?? 0;
  }

  refreshAllSideCircleRankInfo() {
    if (this.userFestaInfo.userFestaData) {
      this.loadAllSideCircleRankInfo(this.userFestaInfo.userFestaData);
    }
  }

  refreshSameSideCircleRankInfo() {
    if (this.userFestaInfo.userFestaData) {
      this.loadSameSideCircleRankInfo(this.userFestaInfo.userFestaData);
    }
  }

  formatCircleIfShowPlaceId(circleFestaData: Maimai2CircleFestaData, isShowPlaceId: boolean) {
    if (!isShowPlaceId)
      return circleFestaData.circleName;

    var formatPostfix = ` #${circleFestaData.placeId}`;
    var result = circleFestaData.circleName;
    if (!circleFestaData.circleName.endsWith(formatPostfix))
      result += formatPostfix;
    return result;
  }

  protected readonly length = length;
}
