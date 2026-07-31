import {AbstractControl, FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {Component, OnInit, ChangeDetectionStrategy, TemplateRef} from '@angular/core';
import {ApiService} from '../api.service';
import {StatusCode} from '../status-code';
import {MessageService} from '../message.service';
import {SHA256, enc} from 'crypto-js';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {Clipboard} from '@angular/cdk/clipboard';
import {TranslateService} from '@ngx-translate/core';

const GAME_VERSION_PATTERN = /^[0-9]+\.[0-9]{2}\.[0-9]{2}$/;

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
  gameVersionForm: FormGroup<{
    romVersion: FormControl<string>;
    dataVersion: FormControl<string>;
  }>;
  gameVersionEditor: GameVersionEditor | null = null;
  restoreConfirmationPending = false;
  private pendingGameVersionEditor: GameVersionEditor | null = null;

  get gameVersionMutationPending(): boolean {
    return this.gameVersionEditor !== null &&
      this.pendingGameVersionEditor === this.gameVersionEditor;
  }

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    protected modalService: NgbModal,
    private api: ApiService,
    protected clipboard: Clipboard,
    private translate: TranslateService) {
    this.gameVersionForm = this.fb.nonNullable.group({
      romVersion: ['', [
        Validators.required,
        Validators.pattern(GAME_VERSION_PATTERN)]],
      dataVersion: ['', [
        Validators.required,
        Validators.pattern(GAME_VERSION_PATTERN)]]
    });
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

  openGameVersionEditor(
    keychip: Keychip,
    version: KeychipGameVersion,
    modalTemplate: TemplateRef<unknown>
  ): NgbModalRef {
    const editor = {keychip, version};
    this.gameVersionEditor = editor;
    this.restoreConfirmationPending = false;
    const pair = version.manual.romVersion !== null && version.manual.dataVersion !== null
      ? version.manual
      : version.effective;
    this.gameVersionForm.setValue({
      romVersion: pair.romVersion,
      dataVersion: pair.dataVersion
    });
    const modal = this.modalService.open(modalTemplate, {
      centered: true,
      ariaLabelledBy: 'keychipGameVersionModalTitle',
      beforeDismiss: () => this.pendingGameVersionEditor !== editor
    });
    const clearEditor = () => {
      if (this.gameVersionEditor === editor) {
        this.gameVersionEditor = null;
        if (this.pendingGameVersionEditor === editor) {
          this.pendingGameVersionEditor = null;
        }
        this.restoreConfirmationPending = false;
      }
    };
    void modal.result.then(clearEditor, clearEditor);
    return modal;
  }

  saveGameVersion(modal: NgbModalRef) {
    const editor = this.gameVersionEditor;
    if (!editor || this.pendingGameVersionEditor === editor) {
      return;
    }
    if (this.gameVersionForm.invalid) {
      this.gameVersionForm.markAllAsTouched();
      return;
    }
    this.pendingGameVersionEditor = editor;
    const path = this.gameVersionPath(editor);
    this.api.put(path, this.gameVersionForm.getRawValue()).subscribe({
      next: resp => this.handleMutationResponse(
        resp, editor, modal,
        'KeychipPage.GameVersions.SaveSuccess',
        'KeychipPage.GameVersions.SaveFailed'),
      error: () => this.handleMutationError(
        editor, 'KeychipPage.GameVersions.SaveFailed')
    });
  }

  clearGameVersion(modal: NgbModalRef) {
    const editor = this.gameVersionEditor;
    if (!editor || this.pendingGameVersionEditor === editor) {
      return;
    }
    this.pendingGameVersionEditor = editor;
    this.api.delete(this.gameVersionPath(editor)).subscribe({
      next: resp => this.handleMutationResponse(
        resp, editor, modal,
        'KeychipPage.GameVersions.RestoreSuccess',
        'KeychipPage.GameVersions.RestoreFailed'),
      error: () => this.handleMutationError(
        editor, 'KeychipPage.GameVersions.RestoreFailed')
    });
  }

  requestClearGameVersion(modal: NgbModalRef) {
    if (this.gameVersionMutationPending) {
      return;
    }
    if (!this.restoreConfirmationPending) {
      this.restoreConfirmationPending = true;
      return;
    }
    this.clearGameVersion(modal);
  }

  gameVersionSourceKey(source: GameVersionSource): string {
    const keys: Record<GameVersionSource, string> = {
      MANUAL: 'KeychipPage.GameVersions.ManualSource',
      OBSERVED: 'KeychipPage.GameVersions.ObservedSource',
      DEFAULT: 'KeychipPage.GameVersions.DefaultSource'
    };
    return keys[source];
  }

  private gameVersionPath(editor: GameVersionEditor): string {
    const keychipId = encodeURIComponent(editor.keychip.keychipId.shortValue);
    return `api/user/keychip/${keychipId}/game-version/${editor.version.game.toUpperCase()}`;
  }

  private handleMutationResponse(
    response: unknown,
    editor: GameVersionEditor,
    modal: NgbModalRef,
    successKey: string,
    failureKey: string
  ) {
    if (!this.isCurrentMutation(editor)) {
      return;
    }
    this.pendingGameVersionEditor = null;
    if (this.isRecord(response) &&
      this.isRecord(response.status) &&
      response.status.code === StatusCode.OK &&
      this.isGameVersionResponse(response.data, editor.version.game) &&
      this.replaceGameVersion(editor.keychip, response.data)) {
      this.noticeTranslated(successKey, 'success');
      modal.close();
      return;
    }
    this.noticeTranslated(failureKey, 'danger');
  }

  private handleMutationError(editor: GameVersionEditor, failureKey: string) {
    if (!this.isCurrentMutation(editor)) {
      return;
    }
    this.pendingGameVersionEditor = null;
    this.noticeTranslated(failureKey, 'danger');
  }

  private isCurrentMutation(editor: GameVersionEditor): boolean {
    return this.gameVersionEditor === editor && this.pendingGameVersionEditor === editor;
  }

  private replaceGameVersion(keychip: Keychip, updated: KeychipGameVersion): boolean {
    if (!keychip.gameVersions) {
      return false;
    }
    const index = keychip.gameVersions.findIndex(version => version.game === updated.game);
    if (index < 0) {
      return false;
    }
    keychip.gameVersions[index] = updated;
    return true;
  }

  private isGameVersionResponse(
    value: unknown,
    requestedGame: KeychipGameVersion['game']
  ): value is KeychipGameVersion {
    if (!this.isRecord(value) || value.game !== requestedGame) {
      return false;
    }
    return this.isNullableVersionPair(value.observed) &&
      this.isNullableVersionPair(value.manual) &&
      this.isVersionPair(value.effective) &&
      this.isVersionSourcePair(value.source);
  }

  private isNullableVersionPair(value: unknown): value is NullableGameVersionPair {
    return this.isRecord(value) &&
      this.isNullableVersion(value.romVersion) &&
      this.isNullableVersion(value.dataVersion);
  }

  private isVersionPair(value: unknown): value is GameVersionPair {
    return this.isRecord(value) &&
      this.isVersion(value.romVersion) &&
      this.isVersion(value.dataVersion);
  }

  private isVersionSourcePair(value: unknown): value is GameVersionSourcePair {
    return this.isRecord(value) &&
      this.isGameVersionSource(value.romVersion) &&
      this.isGameVersionSource(value.dataVersion);
  }

  private isNullableVersion(value: unknown): value is string | null {
    return value === null || this.isVersion(value);
  }

  private isVersion(value: unknown): value is string {
    return typeof value === 'string' && GAME_VERSION_PATTERN.test(value);
  }

  private isGameVersionSource(value: unknown): value is GameVersionSource {
    return value === 'MANUAL' || value === 'OBSERVED' || value === 'DEFAULT';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
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
  romVersion: string;
  dataVersion: string;
}

export interface NullableGameVersionPair {
  romVersion: string | null;
  dataVersion: string | null;
}

export interface GameVersionSourcePair {
  romVersion: GameVersionSource;
  dataVersion: GameVersionSource;
}

export interface KeychipGameVersion {
  game: 'CHUSAN' | 'ONGEKI';
  observed: NullableGameVersionPair;
  manual: NullableGameVersionPair;
  effective: GameVersionPair;
  source: GameVersionSourcePair;
}

interface GameVersionEditor {
  keychip: Keychip;
  version: KeychipGameVersion;
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
