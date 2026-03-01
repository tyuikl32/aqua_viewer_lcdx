import { Component, OnInit, ViewChild } from '@angular/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import { HttpParams } from '@angular/common/http';
import { NgxIndexedDBService } from 'ngx-indexed-db';
import { environment } from '../../../../environments/environment';
import { catchError, map, tap } from 'rxjs/operators';
import { Observable, of } from 'rxjs';
import { NgbActiveModal, NgbModal, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
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
import { Maimai2ExchangeItemData, Maimai2ExchangeItemType, Maimai2ExchangeItemTypeName } from '../model/Maimai2ExchangeItemData';
import { Maimai2UserExchangeItemData } from '../model/Maimai2UserExchangeItemData';
import { Maimai2GetExchangeItemDataListResp } from '../model/Maimai2GetExchangeItemDataListResp';
import { Maimai2GetUserExchangeItemDataInfoResp } from '../model/Maimai2GetUserExchangeItemDataInfoResp';
import { Maimai2UserServerMissionPointInfoResp } from '../model/Maimai2UserServerMissionPointInfoResp';
import { Maimai2ServerMissionUserPointData } from '../model/Maimai2ServerMissionUserPointData';

@Component({
  selector: 'app-maimai2-point-exchanges',
  templateUrl: './maimai2-point-exchanges.component.html',
  styleUrls: ['./maimai2-point-exchanges.component.css']
})
export class Maimai2PointExchangesComponent implements OnInit {

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

  pageSize: number = 20

  filterExchangeInfoList: Maimai2ExchangeItemData[] = [];
  filterExchangeInfoListTotalCount: number = 0;
  filterExchangeInfoListPage: number = 0;

  filterItemType: Maimai2ExchangeItemType = null;

  userPointData: Maimai2ServerMissionUserPointData = { totalPoints: 0, availablePoints: 0 };

  searchKeyword: string = "";

  onlyEnable = true;

  userExchangeInfoMap: Map<number, Maimai2UserExchangeItemData> = new Map<number, Maimai2UserExchangeItemData>();

  ngOnInit() {
    this.aimeId = String(this.userService.currentUser.defaultCard.extId);
    this.load(0);
  }

  load(exchangeItemListPage: number) {
    this.loadExchangeItemDataList(exchangeItemListPage);
    this.loadUserServerMissionInfo();
    this.loadUserPointsInfo();
  }

  loadUserPointsInfo() {
    const param = new HttpParams().set('aimeId', this.aimeId).set('page', 0).set('size', 1);
    this.api.get('api/game/maimai2/userServerMissionPointInfo', param).pipe().subscribe(
      (data: ApiResponse<Maimai2UserServerMissionPointInfoResp>) => {
        if (isOk(data)) {
          this.userPointData = data.data.userPointData;
        }
        else
          this.toastShowFailedMessage(data, "获取玩家任务点数信息失败");
        console.log(`loadUserPointsInfo() loaded successfully`);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadUserPointsInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  loadExchangeItemDataList(page: number) {
    const param = new HttpParams()
      .set('aimeId', this.aimeId)
      .set('page', page)
      .set('size', this.pageSize)
      .set('onlyEnable', this.onlyEnable)
      .set('filterItemType', this.filterItemType == null ? 0 : this.filterItemType)
      .set('searchPattern', this.searchKeyword);

    this.api.get('api/game/maimai2/exchangeItemDataList', param).pipe().subscribe(
      (data: ApiResponse<Maimai2GetExchangeItemDataListResp>) => {
        if (isOk(data)) {
          this.filterExchangeInfoList = data.data.filterExchangeItemDataList;
          this.filterExchangeInfoListPage = page;
          this.filterExchangeInfoListTotalCount = data.data.filterListTotalCount;
        }
        else
          this.toastShowFailedMessage(data, "获取兑换物品列表失败");
        console.log(`loadExchangeItemDataList() loaded successfully, page = ${page}`);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadExchangeItemDataList() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  loadUserServerMissionInfo() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/maimai2/userExchangeItemDataInfo', param).pipe().subscribe(
      (data: ApiResponse<Maimai2GetUserExchangeItemDataInfoResp>) => {
        if (isOk(data)) {
          this.userExchangeInfoMap = new Map<number, Maimai2UserExchangeItemData>();
          for (let userItemData of data.data.exchangeItemDataList) {
            this.userExchangeInfoMap.set(userItemData.exchangedItemDataId, userItemData);
          }
        }
        else
          this.toastShowFailedMessage(data, "获取玩家兑换物品信息失败");
        console.log(`loadUserExchangeItemInfo() loaded successfully`);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadUserExchangeItemInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );
  }

  getUserExchangedCount(exchangeItemDataId: number): number {
    return this.userExchangeInfoMap.get(exchangeItemDataId)?.exchangedTotalCount ?? 0;
  }

  canUserExchange(itemData: Maimai2ExchangeItemData): boolean {
    const userExchangedCount = this.getUserExchangedCount(itemData.id);
    //不可兑换
    if (!itemData.enable)
      return false;
    //超过个人兑换限制了
    if (itemData.limitCount >= 0 && userExchangedCount >= itemData.limitCount)
      return false;
    //卖完了
    if (itemData.stockCount >= 0 && itemData.exchangedCount >= itemData.stockCount)
      return false;
    if (this.userPointData.availablePoints < itemData.costPoints)
      return false;
    return true;
  }

  getImageUrl(itemData: Maimai2ExchangeItemData): string {
    let idLength = 6;
    let fileNamePrefix = "UI_Icon_";
    let fileTypeName = "icon";

    let specialPath = undefined;

    var type = Maimai2ExchangeItemType[itemData.itemType] as any;

    switch (type) {
      case Maimai2ExchangeItemType.Plate:
        fileNamePrefix = "UI_Plate_";
        fileTypeName = "nameplate";
        break;
      case Maimai2ExchangeItemType.Title:
        specialPath = `assets/mai2/common/UI_CLC_Base_GetUserTitle.webp`;
        break;
      case Maimai2ExchangeItemType.Icon:
        fileNamePrefix = "UI_Icon_";
        fileTypeName = "icon";
        break;
      case Maimai2ExchangeItemType.Present:
        specialPath = `assets/mai2/common/UI_CHR_Icon_Present.webp`;
        break;
      case Maimai2ExchangeItemType.Character:
        fileNamePrefix = "UI_Chara_";
        fileTypeName = "chara";
        break;
      case Maimai2ExchangeItemType.Partner:
        fileNamePrefix = "UI_Partner_";
        fileTypeName = "partner";
        break;
      case Maimai2ExchangeItemType.Frame:
        fileNamePrefix = "UI_Frame_";
        fileTypeName = "frame";
        break;
      case Maimai2ExchangeItemType.Ticket:
        specialPath = `assets/mai2/common/UI_CMN_Tix_LinkTix_L.webp`;
        break;
      case Maimai2ExchangeItemType.Mile:
        specialPath = `assets/mai2/common/UI_CLC_Maimile.webp`;
        break;
      case Maimai2ExchangeItemType.KaleidxScopeKey:
        specialPath = `assets/mai2/common/UI_KLD_DiscoverCourseKey_0${itemData.itemId}.webp`;
        break;
      case Maimai2ExchangeItemType.DXPass:
        specialPath = `assets/mai2/common/dxpass_${itemData.itemId}.webp`;
        break;
    }

    if (specialPath !== undefined)
      return `${environment.assetsHost}${specialPath}`;

    return `${environment.assetsHost}assets/mai2/${fileTypeName}/${fileNamePrefix}${itemData.itemId.toString().padStart(idLength, '0')}.webp`;
  }

  toastShowFailedMessage(apiResp: ApiResponse<any>, contentPrefix: string) {
    var msg = `${contentPrefix}: [${apiResp?.status?.code}] ${apiResp?.status?.message}`;
    this.messageService.toastService.show(msg);
  }

  exchangeItemTypes = Object.values(Maimai2ExchangeItemType)
    .filter(value => typeof value === 'number')
    .map(value => ({ value, name: this.getExchangeItemTypeNameByValue(value as Maimai2ExchangeItemType) }));

  selectedExchangeItem: Maimai2ExchangeItemData = null;

  // 获取物品类型名称
  getExchangeItemTypeName(type: any): string {
    return Maimai2ExchangeItemTypeName[Maimai2ExchangeItemType[type.value].toString()] || '未知';
  }

  // 根据数值获取物品类型名称
  getExchangeItemTypeNameByValue(value: Maimai2ExchangeItemType): string {
    return Maimai2ExchangeItemTypeName[value] || '未知';
  }

  // 获取物品类型徽章样式
  getItemTypeBadgeClass(itemType: Maimai2ExchangeItemType): string {
    const typeClassMap = {
      [Maimai2ExchangeItemType.Plate]: 'bg-plate',
      [Maimai2ExchangeItemType.Title]: 'bg-title',
      [Maimai2ExchangeItemType.Icon]: 'bg-icon',
      [Maimai2ExchangeItemType.Present]: 'bg-present',
      [Maimai2ExchangeItemType.Character]: 'bg-character',
      [Maimai2ExchangeItemType.Partner]: 'bg-partner',
      [Maimai2ExchangeItemType.Frame]: 'bg-frame',
      [Maimai2ExchangeItemType.Ticket]: 'bg-ticket',
      [Maimai2ExchangeItemType.Mile]: 'bg-mile',
      [Maimai2ExchangeItemType.KaleidxScopeKey]: 'bg-kaleidxScopeKey',
      [Maimai2ExchangeItemType.DXPass]: 'bg-dxpass'
    };
    return typeClassMap[Maimai2ExchangeItemType[itemType]] || 'bg-unknown';
  }

  // 获取卡片尺寸类
  getCardSizeClass(itemType: Maimai2ExchangeItemType): string {
    const sizeClassMap = {
      [Maimai2ExchangeItemType.Plate]: 'col-type-1',
      [Maimai2ExchangeItemType.Title]: 'col-type-2',
      [Maimai2ExchangeItemType.Icon]: 'col-type-3',
      [Maimai2ExchangeItemType.Present]: 'col-type-4',
      [Maimai2ExchangeItemType.Character]: 'col-type-9',
      [Maimai2ExchangeItemType.Partner]: 'col-type-10',
      [Maimai2ExchangeItemType.Frame]: 'col-type-11',
      [Maimai2ExchangeItemType.Ticket]: 'col-type-12',
      [Maimai2ExchangeItemType.Mile]: 'col-type-13',
      [Maimai2ExchangeItemType.KaleidxScopeKey]: 'col-type-15',
      [Maimai2ExchangeItemType.DXPass]: 'col-type-901'
    };
    return sizeClassMap[itemType] || 'card-size-default';
  }

  // 获取库存状态
  getStockStatus(item: Maimai2ExchangeItemData): string {
    if (item.stockCount === -1) return '不限量';
    const remaining = item.stockCount - item.exchangedCount;
    if (remaining <= 0) return '已售罄';
    if (remaining <= 10) return `仅剩${remaining}个`;
    return `剩余${remaining}个`;
  }

  // 获取库存状态样式
  getStockStatusClass(item: Maimai2ExchangeItemData): string {
    if (item.stockCount === -1) return 'text-success';
    const remaining = item.stockCount - item.exchangedCount;
    if (remaining <= 0) return 'text-danger';
    if (remaining <= 10) return 'text-warning';
    return 'text-success';
  }

  // 获取不能兑换的原因
  getCannotExchangeReason(item: Maimai2ExchangeItemData): string {
    if (!item.enable) return '暂未开放';
    if (item.limitCount >= 0 && this.getUserExchangedCount(item.id) >= item.limitCount) {
      return '已达兑换上限';
    }
    if (item.stockCount >= 0 && item.exchangedCount >= item.stockCount) {
      return '库存不足';
    }
    if (this.userPointData.availablePoints < item.costPoints) {
      return '点数不足';
    }
    return '无法兑换';
  }

  getMaxPage(): number {
    return Math.ceil(this.filterExchangeInfoListTotalCount / this.pageSize) - 1;
  }

  getPageNumbers(): number[] {
    const maxPage = this.getMaxPage();
    const currentPage = this.filterExchangeInfoListPage;
    const pageNumbers: number[] = [];

    let start = Math.max(0, currentPage - 2);
    let end = Math.min(maxPage, currentPage + 2);

    for (let i = start; i <= end; i++) {
      pageNumbers.push(i);
    }

    return pageNumbers;
  }

  openExchangeModal(item: Maimai2ExchangeItemData) {
    this.selectedExchangeItem = item;
    this.modalService.open(this.exchangeModal, {
      size: 'lg',
      centered: true,
      backdrop: 'static'
    });
  }

  confirmExchange(modal: NgbActiveModal) {
    const param = new HttpParams()
      .set('aimeId', this.aimeId)
      .set('exchangeId', this.selectedExchangeItem.id);
    this.api.post('api/game/maimai2/exchangeItem', param).pipe().subscribe(
      (data: ApiResponse<Boolean>) => {
        if (isOk(data)) {
          this.messageService.toastService.show(`兑换 ${this.selectedExchangeItem.name} 成功！`, {
            classname: 'bg-success text-light',
            delay: 3000
          });

          this.load(this.filterExchangeInfoListPage);
        }
        else
          this.toastShowFailedMessage(data, "获取玩家兑换物品信息失败");
        console.log(`loadUserExchangeItemInfo() loaded successfully`);
      }
      ,
      (error: string) => {
        this.messageService.notice(error);
        console.error(`loadUserExchangeItemInfo() failed, error = ${error}`);
        return of({ data: [], error: true });
      }
    );

    modal.close();
  }

  closeModal() {
    this.modalService.dismissAll();
  }

  @ViewChild('exchangeModal') exchangeModal: any;

  protected readonly length = length;
}
