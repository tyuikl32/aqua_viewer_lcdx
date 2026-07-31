import {Clipboard} from '@angular/cdk/clipboard';
import {FormBuilder} from '@angular/forms';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {TranslateService} from '@ngx-translate/core';
import {of, throwError} from 'rxjs';

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
  let modalRef: {close: jasmine.Spy};
  let chusan: KeychipGameVersion;
  let ongeki: KeychipGameVersion;
  let keychip: Keychip;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    messages = jasmine.createSpyObj<MessageService>('MessageService', ['notice']);
    modalService = jasmine.createSpyObj<NgbModal>('NgbModal', ['open']);
    translate = jasmine.createSpyObj<TranslateService>('TranslateService', ['instant']);
    translate.instant.and.callFake((key: string) => `translated:${key}`);
    modalRef = {close: jasmine.createSpy('close')};
    modalService.open.and.returnValue(modalRef as never);

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

  it('prefills the complete manual pair when opening the editor', () => {
    component.openGameVersionEditor(keychip, chusan, {});

    expect(component.selectedKeychip).toBe(keychip);
    expect(component.selectedGameVersion).toBe(chusan);
    expect(component.gameVersionForm.value).toEqual({
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

    component.openGameVersionEditor(keychip, partialManual, {});

    expect(component.gameVersionForm.value).toEqual({
      romVersion: '2.50.01',
      dataVersion: '2.50.00'
    });
  });

  it('does not send an invalid manual pair', () => {
    component.openGameVersionEditor(keychip, chusan, {});
    component.gameVersionForm.setValue({romVersion: '', dataVersion: '2.40.00'});

    component.saveGameVersion(keychip, modalRef);

    expect(api.put).not.toHaveBeenCalled();
  });

  it('sends an atomic PUT and replaces only the returned game entry', () => {
    const updatedChusan = versionEntry('CHUSAN', {
      observed: chusan.observed,
      manual: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      effective: {romVersion: '2.41.01', dataVersion: '2.41.00'},
      source: {romVersion: 'MANUAL', dataVersion: 'MANUAL'}
    });
    component.openGameVersionEditor(keychip, chusan, {});
    component.gameVersionForm.setValue({romVersion: '2.41.01', dataVersion: '2.41.00'});
    api.put.and.returnValue(of({status: {code: StatusCode.OK}, data: updatedChusan}));

    component.saveGameVersion(keychip, modalRef);

    expect(api.put).toHaveBeenCalledOnceWith(
      'api/user/keychip/A39E01A0001/game-version/CHUSAN',
      {romVersion: '2.41.01', dataVersion: '2.41.00'}
    );
    expect(keychip.gameVersions).toEqual([updatedChusan, ongeki]);
    expect(messages.notice).toHaveBeenCalledWith(
      'translated:KeychipPage.GameVersions.SaveSuccess',
      'success'
    );
    expect(modalRef.close).toHaveBeenCalled();
  });

  it('does not update or close when PUT returns an error status', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, {});
    api.put.and.returnValue(of({status: {code: StatusCode.BAD_REQUEST, message: 'invalid'}}));

    component.saveGameVersion(keychip, modalRef);

    expect(keychip.gameVersions).toEqual(originalEntries);
    expect(messages.notice).toHaveBeenCalledWith(
      'translated:KeychipPage.GameVersions.SaveFailed',
      'danger'
    );
    expect(modalRef.close).not.toHaveBeenCalled();
  });

  it('does not update or close when PUT request fails', () => {
    const originalEntries = keychip.gameVersions.slice();
    component.openGameVersionEditor(keychip, chusan, {});
    api.put.and.returnValue(throwError(() => new Error('network')));

    component.saveGameVersion(keychip, modalRef);

    expect(keychip.gameVersions).toEqual(originalEntries);
    expect(messages.notice).toHaveBeenCalledWith(
      'translated:KeychipPage.GameVersions.SaveFailed',
      'danger'
    );
    expect(modalRef.close).not.toHaveBeenCalled();
  });

  it('sends DELETE and replaces only the cleared game entry', () => {
    const automaticChusan = versionEntry('CHUSAN', {
      observed: chusan.observed,
      manual: {romVersion: null, dataVersion: null},
      effective: chusan.observed,
      source: {romVersion: 'OBSERVED', dataVersion: 'OBSERVED'}
    });
    api.delete.and.returnValue(of({status: {code: StatusCode.OK}, data: automaticChusan}));

    component.clearGameVersion(keychip, chusan, modalRef);

    expect(api.delete).toHaveBeenCalledOnceWith(
      'api/user/keychip/A39E01A0001/game-version/CHUSAN'
    );
    expect(keychip.gameVersions).toEqual([automaticChusan, ongeki]);
    expect(messages.notice).toHaveBeenCalledWith(
      'translated:KeychipPage.GameVersions.RestoreSuccess',
      'success'
    );
    expect(modalRef.close).toHaveBeenCalled();
  });

  it('does not update or close when DELETE returns an error status', () => {
    const originalEntries = keychip.gameVersions.slice();
    api.delete.and.returnValue(of({status: {code: StatusCode.BAD_REQUEST, message: 'invalid'}}));

    component.clearGameVersion(keychip, chusan, modalRef);

    expect(keychip.gameVersions).toEqual(originalEntries);
    expect(messages.notice).toHaveBeenCalledWith(
      'translated:KeychipPage.GameVersions.RestoreFailed',
      'danger'
    );
    expect(modalRef.close).not.toHaveBeenCalled();
  });

  it('does not update or close when DELETE request fails', () => {
    const originalEntries = keychip.gameVersions.slice();
    api.delete.and.returnValue(throwError(() => new Error('network')));

    component.clearGameVersion(keychip, chusan, modalRef);

    expect(keychip.gameVersions).toEqual(originalEntries);
    expect(messages.notice).toHaveBeenCalledWith(
      'translated:KeychipPage.GameVersions.RestoreFailed',
      'danger'
    );
    expect(modalRef.close).not.toHaveBeenCalled();
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
});

function versionEntry(
  game: 'CHUSAN' | 'ONGEKI',
  values: Omit<KeychipGameVersion, 'game'>
): KeychipGameVersion {
  return {game, ...values};
}
