import {Component, Input, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {NgbActiveModal, NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {MessageService} from '../../../../../message.service';
import {ApiService} from '../../../../../api.service';
import {V2Item} from '../../model/V2Item';
import { HttpParams } from '@angular/common/http';
import {NgxIndexedDBService} from 'ngx-indexed-db';
import {environment} from '../../../../../../environments/environment';
import { ChusanTrophy } from '../../model/ChusanTrophy';
import { ChusanNamePlate } from '../../model/ChusanNamePlate';
import { ChusanSystemVoice } from '../../model/ChusanSystemVoice';
import { ChusanMapIcon } from '../../model/ChusanMapIcon';
import { ChusanAvatarAcc } from '../../model/ChusanAvatarAcc';
import {ChusanFrame} from '../../model/ChusanFrame';
import {ChusanStage} from '../../model/ChusanStage';
import { UserService } from 'src/app/user.service';

@Component({
    selector: 'v2-userbox-setting-dialog',
    templateUrl: 'v2-userbox-setting.html',
    styleUrls: ['v2-userbox.setting.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class V2UserBoxSettingDialog implements OnInit{

  host = environment.assetsHost;
  enableImages = environment.enableImages;
  aimeId: string;
  iList: V2Item[] = [];
  parentComponent: any;
  currentPage: number;
  @Input() public data: V2UserBoxSettingData;

  // 'favorite' mode edits the Mate+ collection the game picks from at random;
  // 'equip' mode sets the single item stored on the profile
  favoriteIds: number[] = [];
  saving = false;

  constructor(
    private api: ApiService,
    private messageService: MessageService,
    private userService: UserService,
    private dbService: NgxIndexedDBService,
    public modalService: NgbModal,
    public activeModal: NgbActiveModal
  ) {
  }

  get favoriteMode(): boolean {
    return this.data.mode === 'favorite';
  }

  pageChanged(page: number) {
    this.currentPage = page;
  }

  isSelected(item: V2Item): boolean {
    return this.favoriteMode ? this.favoriteIds.includes(item.itemId) : this.data.itemId === item.itemId;
  }

  onCardClick(item: V2Item) {
    if (!this.favoriteMode) {
      this.data.itemId = item.itemId;
      return;
    }
    const index = this.favoriteIds.indexOf(item.itemId);
    if (index === -1) {
      this.favoriteIds.push(item.itemId);
    } else {
      this.favoriteIds.splice(index, 1);
    }
  }

  apply() {
    if (!this.favoriteMode) {
      this.parentComponent.handleApplyClick(this.data);
      return;
    }
    this.saving = true;
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.put('api/game/chuni/v2/favorite-collection/' + this.data.itemKind, this.favoriteIds, param).subscribe(
      () => {
        this.saving = false;
        this.parentComponent.handleFavoriteSaved(this.data.itemKind, this.favoriteIds);
        this.activeModal.close();
      },
      error => {
        this.saving = false;
        this.messageService.notice(error);
      }
    );
  }

  ngOnInit() {
    this.aimeId = String(this.userService.currentUser.defaultCard.extId);
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.favoriteIds = [...(this.data.favoriteIds ?? [])];

    // Make all avatar accs available as there is no way to obtain them in game
    if (this.data.itemKind === 11) {
      this.dbService.getAll<ChusanAvatarAcc>('chusanAvatarAcc').subscribe(avatarAccList => {
        this.iList = avatarAccList
          .filter(avatarAcc => avatarAcc.category === this.data.category)
          .map(avatarAcc => {
          return {
            itemKind: 11, itemId: avatarAcc.id, stock: 1, name: avatarAcc.name ? avatarAcc.name : 'Unknown'
          };
        });
        this.jumpToCurrent();
      });
    }
    else if (!this.data.showAllItems) {
      this.api.get('api/game/chuni/v2/item/' + this.data.itemKind, param).subscribe(
        (data: V2Item[]) => {
          if (data) {
            this.loadFromStore(item => data.some(d => d.itemId === item.id));
          }
        },
        error => this.messageService.notice(error)
      );
    }
    else{
      this.loadFromStore(() => true);
    }
  }

  /** Reads the master data for this item kind out of IndexedDB. */
  private loadFromStore(keep: (item: {id: number, name: string}) => boolean) {
    const stores = {
      1: 'chusanNamePlate',
      2: 'chusanFrame',
      3: 'chusanTrophy',
      8: 'chusanMapIcon',
      9: 'chusanSystemVoice',
      13: 'chusanStage',
    };
    const store = stores[this.data.itemKind];
    if (!store) {
      return;
    }
    this.dbService.getAll<ChusanNamePlate | ChusanFrame | ChusanTrophy | ChusanMapIcon | ChusanSystemVoice | ChusanStage>(store)
      .subscribe(list => {
        this.iList = list
          .filter(item => keep(item))
          .map(item => ({itemId: item.id, itemKind: this.data.itemKind, name: item.name, stock: 1}));
        this.jumpToCurrent();
      });
  }

  private jumpToCurrent() {
    const currentIndex = this.iList.findIndex(item => item.itemId === this.data.itemId);
    if (currentIndex !== -1) {
      this.pageChanged(Math.floor(currentIndex / 12) + 1);
    }
  }
}

export interface V2UserBoxSettingData {
  itemKind: number;
  itemId: number;
  category?: number;
  showAllItems: boolean;
  mode?: 'equip' | 'favorite';
  favoriteIds?: number[];
}
