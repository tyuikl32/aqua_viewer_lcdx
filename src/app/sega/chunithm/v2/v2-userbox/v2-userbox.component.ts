import {Component, OnInit} from '@angular/core';
import {NgbModal, NgbModalOptions} from '@ng-bootstrap/ng-bootstrap';
import {ApiService} from '../../../../api.service';
import {MessageService} from '../../../../message.service';
import {NgxIndexedDBService} from 'ngx-indexed-db';
import {V2Profile} from '../model/V2Profile';
import {HttpParams} from '@angular/common/http';
import {V2UserBoxSettingDialog, V2UserBoxSettingData} from './v2-userbox-setting/v2-userbox-setting.dialog';
import {environment} from '../../../../../environments/environment';
import {ChusanTrophy} from '../model/ChusanTrophy';
import {Observable} from 'rxjs';
import {ChusanNamePlate} from '../model/ChusanNamePlate';
import {ChusanSystemVoice} from '../model/ChusanSystemVoice';
import {ChusanMapIcon} from '../model/ChusanMapIcon';
import {ChusanAvatarAcc} from '../model/ChusanAvatarAcc';
import {UserService} from 'src/app/user.service';
import {V2SymbolChat} from '../model/V2SymbolChat';
import {ChusanSymbolChat} from '../model/ChusanSymbolChat';
import {V2SymbolChatSettingComponent} from './v2-symbol-chat-setting/v2-symbol-chat-setting.component';

@Component({
  selector: 'app-v2-userbox',
  templateUrl: './v2-userbox.component.html',
  styleUrls: ['./v2-userbox.component.css']
})
export class V2UserBoxComponent implements OnInit {

  protected readonly Array = Array;

  host = environment.assetsHost;
  enableImages = environment.enableImages;

  showAllItems = false;

  profile: V2Profile;
  symbolChatInfo: V2SymbolChat[];
  aimeId: string;

  items: Observable<[]>;
  customable = [];

  systemVoiceIDs = [34, 0, 1, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 49, 50, 51];
  currentAvatarAcc: { category: number, accId: number } = {category: 0, accId: 0};

  dialogOptions: NgbModalOptions = {
    centered: true,
    size: 'lg',
  };

  scenes = ['Matching', 'OverviewSelf', 'OverviewRival', 'Result', 'BattleResult'];
  selectedScene = 1;

  allSymbolChat: ChusanSymbolChat[];

  constructor(
    private api: ApiService,
    private userService: UserService,
    private messageService: MessageService,
    private dbService: NgxIndexedDBService,
    protected modalService: NgbModal,
  ) {
  }

  ngOnInit() {
    this.refreshProfile();
    this.getSymbolChatInfo();
    this.dbService.getAll<ChusanSymbolChat>('chusanSymbolChat').subscribe(x => this.allSymbolChat = x);
  }

  initCustomable() {
    this.customable = [
      {name: 'Nameplate', value: this.getNamePlateName(this.profile.nameplateId), click: () => this.namePlate()},
      {name: 'Trophy', value: this.getTrophyName(this.profile.trophyId), click: () => this.trophy()},
      {name: 'MapIcon', value: this.getMapIconName(this.profile.mapIconId), click: () => this.mapIcon()},
      {name: 'SystemVoice', value: this.getSystemVoiceName(this.profile.voiceId), click: () => this.systemVoice()},
      {
        name: 'AvatarWear', value: this.getAvatarAccName(this.profile.avatarWear),
        click: () => this.avatarAcc(1, this.profile.avatarWear)
      },
      {
        name: 'AvatarHead', value: this.getAvatarAccName(this.profile.avatarHead),
        click: () => this.avatarAcc(2, this.profile.avatarHead)
      },
      {
        name: 'AvatarFace', value: this.getAvatarAccName(this.profile.avatarFace),
        click: () => this.avatarAcc(3, this.profile.avatarFace)
      },
      // { name: 'AvatarSkin', value: this.getAvatarAccName(this.profile.avatarSkin),
      //   click: () => this.avatarAcc(4, this.profile.avatarSkin) },
      {
        name: 'AvatarItem', value: this.getAvatarAccName(this.profile.avatarItem),
        click: () => this.avatarAcc(5, this.profile.avatarItem)
      },
      // { name: 'AvatarFront', value: this.getAvatarAccName(this.profile.avatarFront),
      //   click: () => this.avatarAcc(6, this.profile.avatarFront) },
      {
        name: 'AvatarBack', value: this.getAvatarAccName(this.profile.avatarBack),
        click: () => this.avatarAcc(7, this.profile.avatarBack)
      },
      // { name: 'Frame', value: this.getFrameName(this.profile.frameId), click: () => this.frame() },
    ];
  }

  playAudio(id: number) {
    const audio = new Audio();
    // tslint:disable-next-line:max-line-length
    audio.src = this.host + 'assets/chuni/systemVoice/systemvoice' + this.profile.voiceId.toString().padStart(4, '0') + '/000' + id.toString().padStart(2, '0') + '.wav';
    audio.load();
    audio.volume = 0.20;
    audio.play();
  }

  refreshProfile() {
    this.aimeId = String(this.userService.currentUser.defaultCard.extId);
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/chuni/v2/profile', param).subscribe(
      data => {
        this.profile = data;
        this.initCustomable();
      },
      error => this.messageService.notice(error)
    );
  }

  getSymbolChatInfo() {
    this.aimeId = String(this.userService.currentUser.defaultCard.extId);
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/chuni/v2/profile/symbolChatInfo', param).subscribe(
      data => {
        if (data) {
          const value = [
            {sceneId: 1, orderId: 0, symbolChatId: 1},
            {sceneId: 1, orderId: 1, symbolChatId: 1},
            {sceneId: 1, orderId: 2, symbolChatId: 1},
            {sceneId: 1, orderId: 3, symbolChatId: 1},
            {sceneId: 2, orderId: 0, symbolChatId: 1},
            {sceneId: 2, orderId: 1, symbolChatId: 1},
            {sceneId: 2, orderId: 2, symbolChatId: 1},
            {sceneId: 2, orderId: 3, symbolChatId: 1},
            {sceneId: 3, orderId: 0, symbolChatId: 1},
            {sceneId: 3, orderId: 1, symbolChatId: 1},
            {sceneId: 3, orderId: 2, symbolChatId: 1},
            {sceneId: 3, orderId: 3, symbolChatId: 1},
            {sceneId: 4, orderId: 0, symbolChatId: 1},
            {sceneId: 4, orderId: 1, symbolChatId: 1},
            {sceneId: 4, orderId: 2, symbolChatId: 1},
            {sceneId: 4, orderId: 3, symbolChatId: 1},
            {sceneId: 5, orderId: 0, symbolChatId: 1},
            {sceneId: 5, orderId: 1, symbolChatId: 1},
            {sceneId: 5, orderId: 2, symbolChatId: 1},
            {sceneId: 5, orderId: 3, symbolChatId: 1},
          ];
          for (const item of data) {
            const symbolChat = value.find(v => v.sceneId === item.sceneId && v.orderId === item.orderId);
            if (symbolChat){
              symbolChat.symbolChatId = item.symbolChatId;
            }
          }
          this.symbolChatInfo = value;
        }
      },
      error => this.messageService.notice(error)
    );
  }

  getNamePlateName(nameplateId: number) {
    return new Promise(resolve => {
      this.dbService.getByID<ChusanNamePlate>('chusanNamePlate', nameplateId)
        .subscribe(NamePlate => resolve(NamePlate.name ? NamePlate.name : 'Unknown'));
    });
  }

  getFrameName(frameId: number) {
    return new Promise(resolve => {
      this.dbService.getByID<ChusanTrophy>('chusanFrame', frameId)
        .subscribe(frame => resolve(frame.name ? frame.name : 'Unknown'));
    });
  }

  getMapIconName(mapiconId: number) {
    return new Promise(resolve => {
      this.dbService.getByID<ChusanMapIcon>('chusanMapIcon', mapiconId)
        .subscribe(mapicon => resolve(mapicon.name ? mapicon.name : 'Unknown'));
    });
  }

  getSystemVoiceName(sysvoiceId: number) {
    return new Promise(resolve => {
      this.dbService.getByID<ChusanSystemVoice>('chusanSystemVoice', sysvoiceId)
        .subscribe(sysvoice => resolve(sysvoice.name ? sysvoice.name : 'Unknown'));
    });
  }

  getAvatarAccName(avatarAccId: number) {
    return new Promise(resolve => {
      this.dbService.getByID<ChusanAvatarAcc>('chusanAvatarAcc', avatarAccId)
        .subscribe(avatarAcc => resolve(avatarAcc.name ? avatarAcc.name : 'Unknown'));
    });
  }

  getTrophyName(trophyId: number) {
    return new Promise(resolve => {
      this.dbService.getByID<ChusanTrophy>('chusanTrophy', trophyId)
        .subscribe(trophy => resolve(trophy.name ? trophy.name : 'Unknown'));
    });
  }

  getBalloonId(sceneId: number, orderId: number) {
    if (this.allSymbolChat) {
      const id = this.symbolChatInfo.find(s => s.sceneId === sceneId && s.orderId === orderId).symbolChatId;
      const symbolChat = this.allSymbolChat.find(s => s.id === id);
      return symbolChat.balloonId;
    }
    return 0;
  }

  getSymbolChatText(sceneId: number, orderId: number) {
    if (this.allSymbolChat) {
      const id = this.symbolChatInfo.find(s => s.sceneId === sceneId && s.orderId === orderId).symbolChatId;
      const symbolChat = this.allSymbolChat.find(s => s.id === id);
      return symbolChat.text;
    }
    return 'なし';
  }

  openItemDialog(dialogData: V2UserBoxSettingData) {
    const dialogRef = this.modalService.open(V2UserBoxSettingDialog, this.dialogOptions);
    dialogRef.componentInstance.data = dialogData;
    dialogRef.componentInstance.parentComponent = this;
  }

  openSymbolChatDialog(dialogData: V2SymbolChat) {
    const dialogRef = this.modalService.open(V2SymbolChatSettingComponent, this.dialogOptions);
    dialogRef.componentInstance.data = dialogData;
  }

  handleApplyClick(data) {
    const {itemKind, itemId} = data;
    let apiURL = '';
    let requestBody = {};
    if (itemKind === 11) {
      const {category, accId} = this.currentAvatarAcc;
      this.api.put('api/game/chuni/v2/profile/avatar', {aimeId: this.aimeId, category, accId: itemId}).subscribe(
        (result) => {
          this.messageService.notice('Successfully changed');
          this.refreshProfile();
          this.modalService.dismissAll();
        }, error => this.messageService.notice(error)
      );
    } else {
      switch (itemKind) {
        case 1: // NamePlate
          apiURL = 'api/game/chuni/v2/profile/plate';
          requestBody = {aimeId: this.aimeId, nameplateId: itemId};
          break;
        case 2: // Frame
          apiURL = 'api/game/chuni/v2/profile/frame';
          requestBody = {aimeId: this.aimeId, frameId: itemId};
          break;
        case 3: // Trophy
          apiURL = 'api/game/chuni/v2/profile/trophy';
          requestBody = {aimeId: this.aimeId, trophyId: itemId};
          break;
        case 8: // MapIcon
          apiURL = 'api/game/chuni/v2/profile/mapicon';
          requestBody = {aimeId: this.aimeId, mapiconId: itemId};
          break;
        case 9: // Voice
          apiURL = 'api/game/chuni/v2/profile/sysvoice';
          requestBody = {aimeId: this.aimeId, voiceId: itemId};
          break;
      }

      this.api.put(apiURL, requestBody).subscribe(() => {
        this.messageService.notice('Successfully changed');
        this.refreshProfile();
        this.modalService.dismissAll();
      }, error => this.messageService.notice(error));
    }
  }

  namePlate() {
    this.openItemDialog({itemKind: 1, itemId: this.profile.nameplateId, showAllItems: this.showAllItems});
  }

  frame() {
    this.openItemDialog({itemKind: 2, itemId: this.profile.frameId, showAllItems: this.showAllItems});
  }

  trophy() {
    this.openItemDialog({itemKind: 3, itemId: this.profile.trophyId, showAllItems: this.showAllItems});
  }

  mapIcon() {
    this.openItemDialog({itemKind: 8, itemId: this.profile.mapIconId, showAllItems: this.showAllItems});
  }

  systemVoice() {
    this.openItemDialog({itemKind: 9, itemId: this.profile.voiceId, showAllItems: this.showAllItems});
  }

  avatarAcc(category: number, accId: number) {
    this.openItemDialog({itemKind: 11, itemId: accId, category, showAllItems: this.showAllItems});
    this.currentAvatarAcc = {category, accId};
  }

  openSymbolChatModal(sceneId: number, orderId: number) {
    const item = this.symbolChatInfo.find(s => s.sceneId === sceneId && s.orderId === orderId);
    this.openSymbolChatDialog(item);
  }

  voicePreview() {
    const randomIndex = Math.floor(Math.random() * this.systemVoiceIDs.length);
    this.playAudio(this.systemVoiceIDs[randomIndex]);
  }
}
