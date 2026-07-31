import {AbstractControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Component, OnInit, ChangeDetectionStrategy} from '@angular/core';
import {ApiService} from '../api.service';
import {StatusCode} from '../status-code';
import {MessageService} from '../message.service';
import {SHA256, enc} from 'crypto-js';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Clipboard} from '@angular/cdk/clipboard';
import {TranslateService} from '@ngx-translate/core';

@Component({
    selector: 'app-keychip',
    templateUrl: './keychip.component.html',
    styleUrls: ['./keychip.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class KeychipComponent implements OnInit {
  keychipLoaded = false;
  trustKeychipLoaded = false;
  keychips: Keychip[];
  trustKeychips: Keychip[];
  trustKeychipForm: FormGroup;
  renameForm: FormGroup;
  gameVersionForm: FormGroup;
  selectedKeychip: Keychip | null = null;
  selectedGameVersion: KeychipGameVersion | null = null;

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    protected modalService: NgbModal,
    private api: ApiService,
    protected clipboard: Clipboard,
    private translate: TranslateService) {
  }

  ngOnInit() {
    this.trustKeychipForm = this.fb.group({
      keychipId: ['', [
        Validators.required,
        Validators.pattern('^A39E-01[A-Z][0-9]{8}$'),
        this.checkKeychipId]]
    });
    this.renameForm = this.fb.group({
      name: ['', [
        Validators.required,
        Validators.maxLength(20)]]
    });
    this.gameVersionForm = this.fb.group({
      romVersion: ['', [
        Validators.required,
        Validators.pattern(/^[0-9]+\.[0-9]{2}\.[0-9]{2}$/)]],
      dataVersion: ['', [
        Validators.required,
        Validators.pattern(/^[0-9]+\.[0-9]{2}\.[0-9]{2}$/)]]
    });
    this.loadKeychip();
    this.loadTrustedKeychip();
  }

  checkKeychipId(control: AbstractControl){
    const shortValue = control.value.substring(0,4) + control.value.substring(5,12);
    const extValue = KeychipId.genExtValue(shortValue);
    const result = control.value.substring(12) === extValue;
    if (!result) {
      return { invalidExtValue: true };
    }
    return null;
  }

  loadKeychip(){
    this.api.get('api/user/keychip').subscribe(
      resp => {
        if (resp?.status) {
          const statusCode: StatusCode = resp.status.code;
          if (statusCode === StatusCode.OK && resp.data) {
            this.keychips = resp.data.map(this.mapKeychip);
          } else {
            this.messageService.notice(resp.status.message);
          }
        } else {
          this.messageService.notice('Load keychips failed.');
        }
        this.keychipLoaded = true;
      },
      error => {
        this.messageService.notice(error);
      }
    );
  }

  loadTrustedKeychip(){
    this.api.get('api/user/keychip/trustKeychip').subscribe(
      resp => {
        if (resp?.status) {
          const statusCode: StatusCode = resp.status.code;
          if (statusCode === StatusCode.OK && resp.data) {
            this.trustKeychips = resp.data.map(d => this.mapKeychip(d.keychip));
          } else {
            this.messageService.notice(resp.status.message);
          }
        } else {
          this.messageService.notice('Load keychips failed.');
        }
        this.trustKeychipLoaded = true;
      },
      error => {
        this.messageService.notice(error);
      }
    );
  }

  genKeychip() {
    this.api.post('api/user/genKeychip').subscribe(resp => {
      if (resp?.status) {
        const statusCode: StatusCode = resp.status.code;
        if (statusCode === StatusCode.OK) {
          this.keychips.push(this.mapKeychip(resp.data));
        }
        else {
          this.messageService.notice(resp.status.message);
        }
      }
      else{
        this.messageService.notice('Gen keychip failed.');
      }
    },
    error => {
      this.messageService.notice(error);
    });
  }

  onTrustKeychipSubmit(modal) {
    if (this.trustKeychipForm.invalid) {
      return;
    }
    var keychipId: string = this.trustKeychipForm.value.keychipId;
    keychipId = keychipId.substring(0,4) + keychipId.substring(5,12);
    const body = {keychipId};
    this.api.post('api/user/keychip/trustKeychip', body).subscribe(resp => {
      if (resp?.status) {
        const statusCode: StatusCode = resp.status.code;
        if (statusCode === StatusCode.OK) {
          this.trustKeychips.push(this.mapKeychip(resp.data.keychip));
          this.trustKeychipForm.reset();
        }
        else {
          this.messageService.notice(resp.status.message);
        }
      }
      else{
        this.messageService.notice('Trust keychip failed.');
      }
    },
    error => {
      this.messageService.notice(error);
    });
    modal.dismiss();
  }

  onRenameSubmit(keychip: Keychip, modal){
    if (this.renameForm.invalid) {
      return;
    }
    var placeName: string = this.renameForm.value.name;
    const keychipId = keychip.keychipId.shortValue;
    const body = {keychipId, placeName};
    this.api.post('api/user/modifyKeychip', body).subscribe(resp => {
      if (resp?.status) {
        const statusCode: StatusCode = resp.status.code;
        if (statusCode === StatusCode.OK) {
          keychip.placeName = placeName;
          this.messageService.notice('Modify place name success.', 'success');
        }
        else {
          this.messageService.notice(resp.status.message);
        }
      }
      else{
        this.messageService.notice('Modify place name failed.', 'danger');
      }
    },
    error => {
      this.messageService.notice(error);
    });
    modal.dismiss();
  }

  onRemoveKeychip(keychip: Keychip, modal){
    var id: number = keychip.id;
    this.api.delete('api/user/keychip/' + id).subscribe(resp => {
      if (resp?.status) {
        const statusCode: StatusCode = resp.status.code;
        if (statusCode === StatusCode.OK) {
          const index = this.keychips.indexOf(keychip);
          this.keychips.splice(index, 1);
        }
        else {
          this.messageService.notice(resp.status.message);
        }
      }
      else{
        this.messageService.notice('Remove keychip failed.');
      }
    },
    error => {
      this.messageService.notice(error);
    });
    modal.dismiss();
  }

  onUntrustKeychip(keychip: Keychip, modal){
    var keychipId: string = keychip.keychipId.shortValue;
    const body = {keychipId};
    this.api.delete('api/user/keychip/trustKeychip', null, body).subscribe(resp => {
      if (resp?.status) {
        const statusCode: StatusCode = resp.status.code;
        if (statusCode === StatusCode.OK) {
          const index = this.trustKeychips.indexOf(keychip);
          this.trustKeychips.splice(index, 1);
        }
        else {
          this.messageService.notice(resp.status.message);
        }
      }
      else{
        this.messageService.notice('Untrust keychip failed.');
      }
    },
    error => {
      this.messageService.notice(error);
    });
    modal.dismiss();
  }

  openGameVersionEditor(keychip: Keychip, version: KeychipGameVersion, modalTemplate) {
    this.selectedKeychip = keychip;
    this.selectedGameVersion = version;
    const pair = version.manual.romVersion !== null && version.manual.dataVersion !== null
      ? version.manual
      : version.effective;
    this.gameVersionForm.setValue({
      romVersion: pair.romVersion,
      dataVersion: pair.dataVersion
    });
    this.modalService.open(modalTemplate, {centered: true});
  }

  saveGameVersion(keychip: Keychip, modal) {
    if (this.gameVersionForm.invalid || !this.selectedGameVersion) {
      return;
    }
    const body = {
      romVersion: this.gameVersionForm.value.romVersion,
      dataVersion: this.gameVersionForm.value.dataVersion
    };
    const path = this.gameVersionPath(keychip, this.selectedGameVersion);
    this.api.put(path, body).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK && resp.data) {
          this.replaceGameVersion(keychip, resp.data);
          this.noticeTranslated('KeychipPage.GameVersions.SaveSuccess', 'success');
          modal.close();
        } else {
          this.noticeTranslated('KeychipPage.GameVersions.SaveFailed', 'danger');
        }
      },
      error: () => this.noticeTranslated('KeychipPage.GameVersions.SaveFailed', 'danger')
    });
  }

  clearGameVersion(keychip: Keychip, version: KeychipGameVersion, modal) {
    this.api.delete(this.gameVersionPath(keychip, version)).subscribe({
      next: resp => {
        if (resp?.status?.code === StatusCode.OK && resp.data) {
          this.replaceGameVersion(keychip, resp.data);
          this.noticeTranslated('KeychipPage.GameVersions.RestoreSuccess', 'success');
          modal.close();
        } else {
          this.noticeTranslated('KeychipPage.GameVersions.RestoreFailed', 'danger');
        }
      },
      error: () => this.noticeTranslated('KeychipPage.GameVersions.RestoreFailed', 'danger')
    });
  }

  gameVersionSourceKey(source: GameVersionSource): string {
    const keys: Record<GameVersionSource, string> = {
      MANUAL: 'KeychipPage.GameVersions.ManualSource',
      OBSERVED: 'KeychipPage.GameVersions.ObservedSource',
      DEFAULT: 'KeychipPage.GameVersions.DefaultSource'
    };
    return keys[source];
  }

  private gameVersionPath(keychip: Keychip, version: KeychipGameVersion): string {
    const keychipId = encodeURIComponent(keychip.keychipId.shortValue);
    return `api/user/keychip/${keychipId}/game-version/${version.game.toUpperCase()}`;
  }

  private replaceGameVersion(keychip: Keychip, updated: KeychipGameVersion) {
    const index = keychip.gameVersions?.findIndex(version => version.game === updated.game) ?? -1;
    if (index >= 0) {
      keychip.gameVersions[index] = updated;
    }
  }

  private noticeTranslated(key: string, color: 'danger' | 'success') {
    this.messageService.notice(this.translate.instant(key), color);
  }

  mapKeychip(keychip){
    keychip.keychipId = new KeychipId(keychip.keychipId);
    return keychip;
  }

  copyKeychip(keychip: Keychip){
    if(this.clipboard.copy(keychip.keychipId.fullValue)){
      this.messageService.notice('Value has been copied.', 'success')
    }
    else{
      this.messageService.notice('Copying failed.', 'danger')
    }

  }

}

export interface Keychip {
  id: number;
  keychipId: KeychipId;
  placeName: string;
  whiteListed: boolean;
  user: {id: number, name: string};
  gameVersions?: KeychipGameVersion[];
}

export type GameVersionSource = 'MANUAL' | 'OBSERVED' | 'DEFAULT';

export interface GameVersionPair {
  romVersion: string | null;
  dataVersion: string | null;
}

export interface KeychipGameVersion {
  game: 'CHUSAN' | 'ONGEKI';
  observed: GameVersionPair;
  manual: GameVersionPair;
  effective: GameVersionPair;
  source: {
    romVersion: GameVersionSource;
    dataVersion: GameVersionSource;
  };
}

export class KeychipId {
  public shortValue: string;
  public extValue: string;
  public hidden: boolean;

  get displayValue() {
    if (this.hidden) {
      return this.shortValue.substring(0, 4) + '-' + this.shortValue.substring(4, 6) + '*********';
    } else {
      return this.fullValue;
    }
  }

  get fullValue() {
    return this.shortValue.substring(0, 4) + '-' + this.shortValue.substring(4, 11) + this.extValue;
  }

  constructor(shortValue: string) {
    this.shortValue = shortValue;
    this.extValue = KeychipId.genExtValue(shortValue);
    this.hidden = true;
  }


  public static genExtValue(shortValue: string): string {
    const hashOutput = SHA256(shortValue);
    const hashHex = hashOutput.toString(enc.Hex);
    const hashBigInt = BigInt('0x' + hashHex);
    const modResult = hashBigInt % BigInt(10000);
    const resultString = modResult.toString().padStart(4, '0');
    return resultString;
  }
}
