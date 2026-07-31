import {Clipboard} from '@angular/cdk/clipboard';
import {TemplateRef} from '@angular/core';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {FormBuilder} from '@angular/forms';
import {ReactiveFormsModule} from '@angular/forms';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {NgbModal, NgbModalOptions, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {NgbModalModule} from '@ng-bootstrap/ng-bootstrap';
import {provideTranslateService, TranslatePipe, TranslateService} from '@ngx-translate/core';
import {of, Subject, throwError} from 'rxjs';

import {ApiService} from '../api.service';
import {MessageService} from '../message.service';
import {StatusCode} from '../status-code';
import {
  GameVersionSource,
  Keychip,
  KeychipComponent,
  KeychipGameVersion,
  KeychipId
} from './keychip.component';

describe('KeychipComponent game versions', () => {
  let component: KeychipComponent;
  let api: jasmine.SpyObj<ApiService>;
  let messages: jasmine.SpyObj<MessageService>;
  let modalService: jasmine.SpyObj<NgbModal>;
  let translate: jasmine.SpyObj<TranslateService>;
  let modal: TestModal;
  let chusan: KeychipGameVersion;
  let ongeki: KeychipGameVersion;
  let keychip: Keychip;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    messages = jasmine.createSpyObj<MessageService>('MessageService', ['notice']);
    modalService = jasmine.createSpyObj<NgbModal>('NgbModal', ['open']);
    translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translate.instant.and.callFake((key: string) => `translated:${key}`);
    modal = createModal();
    modalService.open.and.returnValue(modal.ref);

    component = new KeychipComponent(
      new FormBuilder(),
      messages,
      modalService,
      api,
      jasmine.createSpyObj<Clipboard>('Clipboard', ['copy']),
      translate
    );
    spyOn(component, 'loadKeychip');
    spyOn(component, 'loadTrustedKeychip');
    component.ngOnInit();

    chusan = versionEntry('CHUSAN', {
      observed: {romVersion: '2.50.01', dataVersion: '2.50.00'},
      manual: {romVersion: '2.40.01', dataVersion: '2.40.00'},
      effective: {romVersion: '2.40.01', dataVersion: '2.40.00'},
      source: {romVersion: 'MANUAL', dataVersion: 'MANUAL'}
    });
    ongeki = versionEntry('ONGEKI', {
      observed: {romVersion: '1.45.00', dataVersion: '1.45.00'},
      manual: {romVersion: null, dataVersion: null},
      effective: {romVersion: '1.45.00', dataVersion: '1.45.00'},
      source: {romVersion: 'OBSERVED', dataVersion: 'OBSERVED'}
    });
    keychip = {
      id: 7,
      keychipId: new KeychipId('A39E01A0001'),
      placeName: 'Cabinet',
      whiteListed: true,
      user: {id: 1, name: 'owner'},
      gameVersions: [chusan, ongeki]
    };
  });

  it('accepts only a complete pair in the exact numeric version format', () => {
    component.gameVersionForm.setValue({romVersion: '12.03.04', dataVersion: '2.40.00'});
    expect(component.gameVersionForm.valid).toBeTrue();

    component.gameVersionForm.setValue({romVersion: '', dataVersion: '2.40.00'});
    expect(component.gameVersionForm.invalid).toBeTrue();

    component.gameVersionForm.setValue({romVersion: '2.4.01', dataVersion: '2.40.00'});
    expect(component.gameVersionForm.invalid).toBeTrue();

    component.gameVersionForm.setValue({romVersion: '2.40.01', dataVersion: '2.40'});
    expect(component.gameVersionForm.invalid).toBeTrue();
  });

  it('prefills the complete manual pair and stores one atomic editor context', () => {
    component.openGameVersionEditor(keychip, chusan, template());

    expect(component.gameVersionEditor).toEqual({keychip, version: chusan});
    expect(component.gameVersionForm.getRawValue()).toEqual({
      romVersion: '2.40.01',
      dataVersion: '2.40.00'
    });
  });

  it('prefills the effective pair when either manual value is absent', () => {
    const partialManual = versionEntry('CHUSAN', {
      observed: {romVersion: '2.50.01', dataVersion: '2.50.00'},
      manual: {romVersion: '2.40.01', dataVersion: null},
      effective: {romVersion: '2.50.01', dataVersion: '2.50.00'},
      source: {romVersion: 'OBSERVED', dataVersion: 'OBSERVED'}
    });

    component.openGameVersionEditor(keychip, partialManual, template());

    expect(component.gameVersionForm.getRawValue()).toEqual({
      romVersion: '2.50.01',
      dataVersion: '2.50.00'
    });
  });

  it('clears the editor context after the modal is cancelled and cannot submit afterwards', async () => {
    component.openGameVersionEditor(keychip, chusan, template());
    modal.dismiss('cancelled');
    await modal.settled;

    expect(component.gameVersionEditor).toBeNull();

    component.saveGameVersion(modal.ref);
    component.clearGameVersion(modal.ref);

    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('does not send save or clear requests without an editor context', () => {
    component.gameVersionForm.setValue({romVersion: '2.40.01', dataVersion: '2.40.00'});

    component.saveGameVersion(modal.ref);
    component.clearGameVersion(modal.ref);

    expect(api.put).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('does not send an invalid manual pair', () => {
    component.openGameVersionEditor(keychip, chusan, template());
    component.gameVersionForm.setValue({romVersion: '', dataVersion: '2.40.00'});

    component.saveGameVersion(modal.ref);

    expect(api.put).not.toHaveBeenCalled();
  });

  it('allows only one mutation while a PUT is pending', () => {
    const response = new Subject<unknown>();
    component.openGameVersionEditor(keychip, chusan, template());
    api.put.and.returnValue(response);

    component.saveGameVersion(modal.ref);
    component.saveGameVersion(modal.ref);
    component.clearGameVersion(modal.ref);

    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.delete).not.toHaveBeenCalled();
    expect(component.gameVersionMutationPending).toBeTrue();

    response.next({status: {code: StatusCode.BAD_REQUEST}});
    expect(component.gameVersionMutationPending).toBeFalse();
  });

  it('allows only one DELETE while restore is pending', () => {
    const response = new Subject<unknown>();
    component.openGameVersionEditor(keychip, chusan, template());
    api.delete.and.returnValue(response);

    component.clearGameVersion(modal.ref);
    component.clearGameVersion(modal.ref);
    component.saveGameVersion(modal.ref);

    expect(api.delete).toHaveBeenCalledTimes(1);
    expect(api.put).not.toHaveBeenCalled();
    expect(component.gameVersionMutationPending).toBeTrue();

    response.error(new Error('network'));
    expect(component.gameVersionMutationPending).toBeFalse();
  });

  it('does not block dismiss while a request is pending', () => {
    const response = new Subject<unknown>();
    component.openGameVersionEditor(keychip, chusan, template());
    const options = modalService.open.calls.mostRecent().args[1] as NgbModalOptions;
    api.put.and.returnValue(response);

    component.saveGameVersion(modal.ref);

    expect(options.beforeDismiss).toBeUndefined();
    expect(component.gameVersionMutationPending).toBeTrue();
  });

  it('unsubscribes and clears pending when the captured modal session settles', async () => {
    const response = new Subject<unknown>();
    component.openGameVersionEditor(keychip, chusan, template());
    api.put.and.returnValue(response);
    component.saveGameVersion(modal.ref);
    expect(response.observers.length).toBe(1);

    modal.dismiss('forced teardown');
    await modal.settled;

    expect(response.observers.length).toBe(0);
    expect(component.gameVersionEditor).toBeNull();
    expect(component.gameVersionMutationPending).toBeFalse();
  });

  it('cancels the active mutation and invalidates the editor when destroyed', () => {
    const response = new Subject<unknown>();
    const originalEntries = keychip.gameVersions.slice();
    const updatedChusan = versionEntry('CHUSAN', {
      observed: chusan.observed,
      manual: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      effective: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      source: {romVersion: 'MANUAL', dataVersion: 'MANUAL'}
    });
    component.openGameVersionEditor(keychip, chusan, template());
    component.requestClearGameVersion(modal.ref);
    api.put.and.returnValue(response);
    component.saveGameVersion(modal.ref);
    expect(response.observers.length).toBe(1);
    expect(component.restoreConfirmationPending).toBeTrue();

    component.ngOnDestroy();

    expect(response.observers.length).toBe(0);
    expect(component.gameVersionEditor).toBeNull();
    expect(component.gameVersionMutationPending).toBeFalse();
    expect(component.restoreConfirmationPending).toBeFalse();
    expect(modal.dismiss).toHaveBeenCalled();

    response.next({status: {code: StatusCode.OK}, data: updatedChusan});
    expect(keychip.gameVersions).toEqual(originalEntries);
    expect(messages.notice).not.toHaveBeenCalled();
    expect(modal.close).not.toHaveBeenCalled();
  });

  it('ignores an old session response without changing or closing the new session', async () => {
    const firstResponse = new Subject<unknown>();
    const secondResponse = new Subject<unknown>();
    const secondModal = createModal();
    const updatedChusan = versionEntry('CHUSAN', {
      observed: chusan.observed,
      manual: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      effective: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      source: {romVersion: 'MANUAL', dataVersion: 'MANUAL'}
    });
    const updatedOngeki = versionEntry('ONGEKI', {
      observed: ongeki.observed,
      manual: {romVersion: '1.44.00', dataVersion: '1.44.00'},
      effective: {romVersion: '1.44.00', dataVersion: '1.44.00'},
      source: {romVersion: 'MANUAL', dataVersion: 'MANUAL'}
    });
    api.put.and.returnValues(firstResponse, secondResponse);

    component.openGameVersionEditor(keychip, chusan, template());
    component.saveGameVersion(modal.ref);
    modal.dismiss('forced teardown');
    await modal.settled;
    expect(firstResponse.observers.length).toBe(0);

    modalService.open.and.returnValue(secondModal.ref);
    component.openGameVersionEditor(keychip, ongeki, template());
    component.saveGameVersion(secondModal.ref);
    expect(component.gameVersionMutationPending).toBeTrue();

    firstResponse.next({status: {code: StatusCode.OK}, data: updatedChusan});

    expect(keychip.gameVersions).toEqual([chusan, ongeki]);
    expect(messages.notice).not.toHaveBeenCalled();
    expect(secondModal.close).not.toHaveBeenCalled();
    expect(component.gameVersionEditor).toEqual({keychip, version: ongeki});
    expect(component.gameVersionMutationPending).toBeTrue();

    secondResponse.next({status: {code: StatusCode.OK}, data: updatedOngeki});
    expect(keychip.gameVersions).toEqual([chusan, updatedOngeki]);
    expect(component.gameVersionMutationPending).toBeFalse();
  });

  it('uses one editor context for the PUT target and replaces only that game entry', () => {
    const updatedChusan = versionEntry('CHUSAN', {
      observed: chusan.observed,
      manual: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      effective: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      source: {romVersion: 'MANUAL', dataVersion: 'MANUAL'}
    });
    component.openGameVersionEditor(keychip, chusan, template());
    component.gameVersionForm.setValue({romVersion: '2.41.01', dataVersion: '2.41.00'});
    api.put.and.returnValue(of({status: {code: StatusCode.OK}, data: updatedChusan}));

    component.saveGameVersion(modal.ref);

    expect(api.put).toHaveBeenCalledOnceWith(
      'api/user/keychip/A39E01A0001/game-version/CHUSAN',
      {romVersion: '2.41.01', dataVersion: '2.41.00'}
    );
    expect(keychip.gameVersions).toEqual([updatedChusan, ongeki]);
    expect(messages.notice).toHaveBeenCalledWith(
      'translated:KeychipPage.GameVersions.SaveSuccess',
      'success'
    );
    expect(modal.close).toHaveBeenCalled();
  });

  it('does not update or close when PUT returns an error status', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, template());
    api.put.and.returnValue(of({status: {code: StatusCode.BAD_REQUEST, message: 'invalid'}}));

    component.saveGameVersion(modal.ref);

    expectGameVersionFailure(originalEntries, 'SaveFailed');
  });

  it('does not update or close when PUT request fails', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, template());
    api.put.and.returnValue(throwError(() => new Error('network')));

    component.saveGameVersion(modal.ref);

    expectGameVersionFailure(originalEntries, 'SaveFailed');
  });

  it('rejects a malformed OK payload from PUT', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, template());
    api.put.and.returnValue(of({
      status: {code: StatusCode.OK},
      data: {
        game: 'CHUSAN',
        observed: chusan.observed,
        manual: chusan.manual,
        effective: {romVersion: '2.40.01'},
        source: chusan.source
      }
    }));

    component.saveGameVersion(modal.ref);

    expectGameVersionFailure(originalEntries, 'SaveFailed');
  });

  it('does not report PUT success when the requested game entry no longer exists', () => {
    const updatedChusan = versionEntry('CHUSAN', {
      observed: chusan.observed,
      manual: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      effective: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      source: {romVersion: 'MANUAL', dataVersion: 'MANUAL'}
    });
    component.openGameVersionEditor(keychip, chusan, template());
    keychip.gameVersions = [ongeki];
    api.put.and.returnValue(of({status: {code: StatusCode.OK}, data: updatedChusan}));

    component.saveGameVersion(modal.ref);

    expectGameVersionFailure([ongeki], 'SaveFailed');
  });

  it('uses the editor context for DELETE and replaces only the cleared game entry', () => {
    const automaticChusan = versionEntry('CHUSAN', {
      observed: chusan.observed,
      manual: {romVersion: null, dataVersion: null},
      effective: {romVersion: '2.50.01', dataVersion: '2.50.00'},
      source: {romVersion: 'OBSERVED', dataVersion: 'OBSERVED'}
    });
    component.openGameVersionEditor(keychip, chusan, template());
    api.delete.and.returnValue(of({status: {code: StatusCode.OK}, data: automaticChusan}));

    component.clearGameVersion(modal.ref);

    expect(api.delete).toHaveBeenCalledOnceWith(
      'api/user/keychip/A39E01A0001/game-version/CHUSAN'
    );
    expect(keychip.gameVersions).toEqual([automaticChusan, ongeki]);
    expect(messages.notice).toHaveBeenCalledWith(
      'translated:KeychipPage.GameVersions.RestoreSuccess',
      'success'
    );
    expect(modal.close).toHaveBeenCalled();
  });

  it('does not update or close when DELETE returns an error status', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, template());
    api.delete.and.returnValue(of({status: {code: StatusCode.BAD_REQUEST, message: 'invalid'}}));

    component.clearGameVersion(modal.ref);

    expectGameVersionFailure(originalEntries, 'RestoreFailed');
  });

  it('does not update or close when DELETE request fails', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, template());
    api.delete.and.returnValue(throwError(() => new Error('network')));

    component.clearGameVersion(modal.ref);

    expectGameVersionFailure(originalEntries, 'RestoreFailed');
  });

  it('rejects a mismatched game in an otherwise valid DELETE payload', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, template());
    api.delete.and.returnValue(of({status: {code: StatusCode.OK}, data: ongeki}));

    component.clearGameVersion(modal.ref);

    expectGameVersionFailure(originalEntries, 'RestoreFailed');
  });

  it('rejects an unknown game in a DELETE payload', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, template());
    api.delete.and.returnValue(of({
      status: {code: StatusCode.OK},
      data: {...chusan, game: 'MAIMAI'}
    }));

    component.clearGameVersion(modal.ref);

    expectGameVersionFailure(originalEntries, 'RestoreFailed');
  });

  it('does not invent game versions when mapping a trusted keychip', () => {
    const trusted = component.mapKeychip({
      id: 8,
      keychipId: 'A39E01A0002',
      placeName: 'Trusted',
      whiteListed: false,
      user: {id: 2, name: 'another owner'}
    });

    expect(trusted.gameVersions).toBeUndefined();
  });

  [
    ['MANUAL', 'KeychipPage.GameVersions.ManualSource'],
    ['OBSERVED', 'KeychipPage.GameVersions.ObservedSource'],
    ['DEFAULT', 'KeychipPage.GameVersions.DefaultSource']
  ].forEach(([source, expectedKey]) => {
    it(`maps ${source} to its distinct translation key`, () => {
      expect(component.gameVersionSourceKey(source as GameVersionSource)).toBe(expectedKey);
    });
  });

  function expectGameVersionFailure(
    originalEntries: KeychipGameVersion[],
    messageKey: 'SaveFailed' | 'RestoreFailed'
  ) {
    expect(keychip.gameVersions).toEqual(originalEntries);
    expect(messages.notice).toHaveBeenCalledWith(
      `translated:KeychipPage.GameVersions.${messageKey}`,
      'danger'
    );
    expect(modal.close).not.toHaveBeenCalled();
    expect(component.gameVersionMutationPending).toBeFalse();
  }
});

describe('KeychipComponent game version UI', () => {
  let fixture: ComponentFixture<KeychipComponent>;
  let component: KeychipComponent;
  let api: jasmine.SpyObj<ApiService>;
  let messages: jasmine.SpyObj<MessageService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    api.get.and.returnValue(of({status: {code: StatusCode.OK}, data: []}));
    messages = jasmine.createSpyObj<MessageService>('MessageService', ['notice']);

    await TestBed.configureTestingModule({
      declarations: [KeychipComponent],
      imports: [ReactiveFormsModule, NgbModalModule, TranslatePipe],
      providers: [
        FormBuilder,
        {provide: ApiService, useValue: api},
        {provide: MessageService, useValue: messages},
        {provide: Clipboard, useValue: jasmine.createSpyObj<Clipboard>('Clipboard', ['copy'])},
        provideTranslateService()
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      KeychipPage: {
        GameVersions: {
          CHUSAN: 'CHUSAN',
          ONGEKI: 'ONGEKI',
          EditGame: 'Edit {{game}} versions'
        }
      }
    });
    translate.use('en');

    fixture = TestBed.createComponent(KeychipComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.keychips = [ownedKeychip(true)];
    component.keychipLoaded = true;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(NgbModal).dismissAll();
    document.querySelectorAll('ngb-modal-window, ngb-modal-backdrop').forEach(node => node.remove());
  });

  it('renders CHUSAN and ONGEKI effective versions for an owned whitelisted keychip', () => {
    const panels = fixture.nativeElement.querySelectorAll('.game-version-panel');

    expect(panels.length).toBe(2);
    expect(panels[0].textContent).toContain('CHUSAN');
    expect(panels[0].textContent).toContain('2.40.01');
    expect(panels[0].textContent).toContain('2.40.00');
    expect(panels[1].textContent).toContain('ONGEKI');
    expect(fixture.nativeElement.querySelector('.badge').textContent).toContain('KeychipPage.Whitelisted');
  });

  it('never renders game version controls for trusted keychips', () => {
    component.trustKeychips = [ownedKeychip(false)];
    component.trustKeychipLoaded = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.trusted-keychip-card .game-version-panel').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.trusted-keychip-card .game-version-edit').length).toBe(0);
  });

  it('shows one combined source when ROM and Data have the same source', () => {
    const panel = fixture.nativeElement.querySelector('.game-version-panel');

    expect(panel.querySelectorAll('.game-version-source-combined').length).toBe(1);
    expect(panel.querySelectorAll('.game-version-source-per-value').length).toBe(0);
  });

  it('shows separate ROM and Data sources when they differ', () => {
    const version = component.keychips[0].gameVersions[1];
    version.source = {romVersion: 'OBSERVED', dataVersion: 'DEFAULT'};
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelectorAll('.game-version-panel')[1];

    expect(panel.querySelectorAll('.game-version-source-combined').length).toBe(0);
    expect(panel.querySelectorAll('.game-version-source-per-value').length).toBe(2);
    expect(panel.textContent).toContain('KeychipPage.GameVersions.ObservedSource');
    expect(panel.textContent).toContain('KeychipPage.GameVersions.DefaultSource');
  });

  it('opens the shared editor with observed values and manual controls', () => {
    click('.game-version-edit');
    fixture.detectChanges();
    const modal = document.querySelector('ngb-modal-window');

    expect(modal.querySelector('.observed-rom').textContent).toContain('2.50.01');
    expect(modal.querySelector('.observed-data').textContent).toContain('2.50.00');
    expect((modal.querySelector('[formControlName="romVersion"]') as HTMLInputElement).value)
      .toBe('2.40.01');
    expect((modal.querySelector('[formControlName="dataVersion"]') as HTMLInputElement).value)
      .toBe('2.40.00');
  });

  it('gives the modal and close action translated accessible names', () => {
    click('.game-version-edit');
    fixture.detectChanges();
    const modal = activeModal();
    const title = modal.querySelector('.modal-title');
    const close = modal.querySelector('.btn-close');

    expect(modal.getAttribute('aria-labelledby')).toBe('keychipGameVersionModalTitle');
    expect(title.id).toBe('keychipGameVersionModalTitle');
    expect(close.getAttribute('aria-label')).toBe('KeychipPage.GameVersions.Close');
  });

  it('dismisses its own open version modal when the fixture is destroyed', () => {
    const modalService = TestBed.inject(NgbModal);
    const open = spyOn(modalService, 'open').and.callThrough();
    click('.game-version-edit');
    fixture.detectChanges();
    const modalRef = open.calls.mostRecent().returnValue;
    const dismiss = spyOn(modalRef, 'dismiss').and.callThrough();

    fixture.destroy();

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(component.gameVersionEditor).toBeNull();
  });

  it('gives each edit action an accessible name containing its game', () => {
    const editButtons = fixture.nativeElement.querySelectorAll('.game-version-edit');

    expect(editButtons[0].getAttribute('aria-label')).toContain('CHUSAN');
    expect(editButtons[1].getAttribute('aria-label')).toContain('ONGEKI');
  });

  it('shows an inline exact-format error for an invalid manual version', () => {
    click('.game-version-edit');
    component.gameVersionForm.controls.romVersion.setValue('2.4.1');
    component.gameVersionForm.controls.romVersion.markAsTouched();
    fixture.detectChanges();

    expect(document.querySelectorAll('.game-version-format-error').length).toBe(1);
    expect(document.querySelector('.game-version-format-error').textContent)
      .toContain('KeychipPage.GameVersions.VersionFormat');
  });

  it('lets an invalid save reveal both errors without requesting an update', () => {
    click('.game-version-edit');
    component.gameVersionForm.setValue({romVersion: '2.4.1', dataVersion: ''});
    fixture.detectChanges();
    const modal = activeModal();
    const save = modal.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(save.disabled).toBeFalse();
    save.click();
    fixture.detectChanges();

    const rom = modal.querySelector('#manualRomVersion') as HTMLInputElement;
    const data = modal.querySelector('#manualDataVersion') as HTMLInputElement;
    expect(api.put).not.toHaveBeenCalled();
    expect(rom.getAttribute('aria-invalid')).toBe('true');
    expect(rom.getAttribute('aria-describedby')).toBe('manualRomVersionError');
    expect(data.getAttribute('aria-invalid')).toBe('true');
    expect(data.getAttribute('aria-describedby')).toBe('manualDataVersionError');
    expect(modal.querySelector('#manualRomVersionError').getAttribute('role')).toBe('alert');
    expect(modal.querySelector('#manualDataVersionError').getAttribute('role')).toBe('alert');
  });

  it('only shows restore automatic for a complete manual pair', () => {
    click('.game-version-edit');
    fixture.detectChanges();
    expect(document.querySelector('.game-version-restore')).not.toBeNull();
    TestBed.inject(NgbModal).dismissAll();

    component.keychips[0].gameVersions[1].manual = {romVersion: null, dataVersion: null};
    fixture.detectChanges();
    clickAll('.game-version-edit', 1);
    fixture.detectChanges();
    expect(activeModal().querySelector('.game-version-restore')).toBeNull();
  });

  it('requires a second restore click before sending DELETE and resets confirmation on settle', async () => {
    const automatic = versionEntry('CHUSAN', {
      observed: {romVersion: '2.50.01', dataVersion: '2.50.00'},
      manual: {romVersion: null, dataVersion: null},
      effective: {romVersion: '2.50.01', dataVersion: '2.50.00'},
      source: {romVersion: 'OBSERVED', dataVersion: 'OBSERVED'}
    });
    api.delete.and.returnValue(of({status: {code: StatusCode.OK}, data: automatic}));
    click('.game-version-edit');
    fixture.detectChanges();

    (document.querySelector('.game-version-restore') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(api.delete).not.toHaveBeenCalled();
    expect(document.querySelector('.game-version-restore').textContent)
      .toContain('KeychipPage.GameVersions.RestoreConfirm');

    (document.querySelector('.game-version-restore') as HTMLButtonElement).click();
    expect(api.delete).toHaveBeenCalledTimes(1);
    await fixture.whenStable();
    expect((component as unknown as {restoreConfirmationPending: boolean}).restoreConfirmationPending)
      .toBeFalse();
  });

  it('keeps close and cancel available while disabling mutation actions during a save', () => {
    const response = new Subject<unknown>();
    api.put.and.returnValue(response);
    click('.game-version-edit');
    fixture.detectChanges();
    const modal = activeModal();

    (modal.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const cancelSelectors = [
      '.modal-header .btn-close',
      '.modal-footer .btn-secondary'
    ];
    const mutationSelectors = [
      '.modal-footer button[type="submit"]',
      '.game-version-restore'
    ];
    cancelSelectors.forEach(selector => {
      expect((modal.querySelector(selector) as HTMLButtonElement).disabled).toBeFalse();
    });
    mutationSelectors.forEach(selector => {
      expect((modal.querySelector(selector) as HTMLButtonElement).disabled).toBeTrue();
    });

    response.error(new Error('network'));
    fixture.detectChanges();
    [...cancelSelectors, ...mutationSelectors].forEach(selector => {
      expect((modal.querySelector(selector) as HTMLButtonElement).disabled).toBeFalse();
    });
  });

  it('disables the restore confirmation action while DELETE is pending', () => {
    const response = new Subject<unknown>();
    api.delete.and.returnValue(response);
    click('.game-version-edit');
    fixture.detectChanges();
    const restore = activeModal().querySelector('.game-version-restore') as HTMLButtonElement;

    restore.click();
    fixture.detectChanges();
    expect(restore.textContent).toContain('KeychipPage.GameVersions.RestoreConfirm');

    restore.click();
    fixture.detectChanges();
    expect(restore.disabled).toBeTrue();

    response.next({status: {code: StatusCode.BAD_REQUEST}});
    fixture.detectChanges();
    expect(restore.disabled).toBeFalse();
  });

  it('provides scoped readable-color hooks for labels, values, and actions', () => {
    const panel = fixture.nativeElement.querySelector('.game-version-panel');

    expect(panel.querySelector('.game-version-label')).not.toBeNull();
    expect(panel.querySelector('.game-version-value')).not.toBeNull();
    expect(panel.querySelector('.game-version-edit')).not.toBeNull();
  });

  it('keeps the panel list single-column while arranging ROM and Data in two columns', () => {
    const list = fixture.nativeElement.querySelector('.game-version-grid') as HTMLElement;
    const values = fixture.nativeElement.querySelector('.game-version-values') as HTMLElement;

    expect(getComputedStyle(list).gridTemplateColumns.split(' ').length).toBe(1);
    expect(getComputedStyle(values).gridTemplateColumns.split(' ').length).toBe(2);
  });

  it('places mixed sources on independent lines so long labels can wrap', () => {
    component.keychips[0].gameVersions[1].source = {
      romVersion: 'OBSERVED',
      dataVersion: 'DEFAULT'
    };
    fixture.detectChanges();
    const sources = fixture.nativeElement.querySelectorAll('.game-version-source-per-value');

    expect(sources.length).toBe(2);
    sources.forEach(source => {
      const style = getComputedStyle(source);
      expect(style.gridColumnStart).toBe('1');
      expect(style.gridColumnEnd).toBe('-1');
      expect(style.whiteSpace).not.toBe('nowrap');
    });
  });

  it('resolves readable colors through Bootstrap 5.2 fallback variables', () => {
    const panel = fixture.nativeElement.querySelector('.game-version-panel') as HTMLElement;
    const value = panel.querySelector('.game-version-value') as HTMLElement;
    const label = panel.querySelector('.game-version-label') as HTMLElement;
    const properties = [
      '--bs-emphasis-color', '--bs-secondary-color', '--bs-tertiary-bg',
      '--bs-body-color', '--bs-secondary', '--bs-body-bg'
    ];
    const original = new Map(properties.map(property => [property, panel.style.getPropertyValue(property)]));

    try {
      panel.style.setProperty('--bs-emphasis-color', 'initial');
      panel.style.setProperty('--bs-secondary-color', 'initial');
      panel.style.setProperty('--bs-tertiary-bg', 'initial');
      panel.style.setProperty('--bs-body-color', 'rgb(1, 2, 3)');
      panel.style.setProperty('--bs-secondary', 'rgb(4, 5, 6)');
      panel.style.setProperty('--bs-body-bg', 'rgb(7, 8, 9)');

      expect(getComputedStyle(value).color).toBe('rgb(1, 2, 3)');
      expect(getComputedStyle(label).color).toBe('rgb(4, 5, 6)');
      expect(getComputedStyle(panel).backgroundColor).toBe('rgb(7, 8, 9)');
    } finally {
      properties.forEach(property => {
        const value = original.get(property);
        value ? panel.style.setProperty(property, value) : panel.style.removeProperty(property);
      });
    }
  });

  function click(selector: string) {
    clickAll(selector, 0);
  }

  function clickAll(selector: string, index: number) {
    (fixture.nativeElement.querySelectorAll(selector)[index] as HTMLElement).click();
  }

  function activeModal(): Element {
    const modals = document.querySelectorAll('ngb-modal-window');
    return modals[modals.length - 1];
  }
});

function versionEntry(
  game: 'CHUSAN' | 'ONGEKI',
  values: Omit<KeychipGameVersion, 'game'>
): KeychipGameVersion {
  return {game, ...values};
}

function ownedKeychip(whiteListed: boolean): Keychip {
  return {
    id: 7,
    keychipId: new KeychipId('A39E01A0001'),
    placeName: 'Cabinet',
    whiteListed,
    user: {id: 1, name: 'owner'},
    gameVersions: [
      versionEntry('CHUSAN', {
        observed: {romVersion: '2.50.01', dataVersion: '2.50.00'},
        manual: {romVersion: '2.40.01', dataVersion: '2.40.00'},
        effective: {romVersion: '2.40.01', dataVersion: '2.40.00'},
        source: {romVersion: 'MANUAL', dataVersion: 'MANUAL'}
      }),
      versionEntry('ONGEKI', {
        observed: {romVersion: '1.45.00', dataVersion: '1.45.00'},
        manual: {romVersion: null, dataVersion: null},
        effective: {romVersion: '1.45.00', dataVersion: '1.45.00'},
        source: {romVersion: 'OBSERVED', dataVersion: 'OBSERVED'}
      })
    ]
  };
}

function template(): TemplateRef<unknown> {
  return {} as TemplateRef<unknown>;
}

interface TestModal {
  ref: NgbModalRef;
  close: jasmine.Spy;
  dismiss: jasmine.Spy;
  settled: Promise<void>;
}

function createModal(): TestModal {
  let resolveResult: (value?: unknown) => void;
  let rejectResult: (reason?: unknown) => void;
  const result = new Promise<unknown>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const settled = result.then(() => undefined, () => undefined);
  const close = jasmine.createSpy('close').and.callFake(value => resolveResult(value));
  const dismiss = jasmine.createSpy('dismiss').and.callFake(reason => rejectResult(reason));
  const ref = {result, close, dismiss} as unknown as NgbModalRef;
  return {ref, close, dismiss, settled};
}
