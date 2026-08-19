import {TestBed} from '@angular/core/testing';
import {HttpClientModule} from '@angular/common/http';
import {of, throwError} from 'rxjs';
import {ApiService} from './api.service';
import {BotPermissionService} from './bot-permission.service';
import {StatusCode} from './status-code';

describe('BotPermissionService', () => {
  let service: BotPermissionService;
  let api: ApiService;

  const okResp = (data: object) => of({status: {code: StatusCode.OK, message: 'OK'}, data});

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientModule],
      providers: [ApiService]
    });
    service = TestBed.inject(BotPermissionService);
    api = TestBed.inject(ApiService);
  });

  it('loads permission and hasManage from EP-01 + EP-18', () => {
    spyOn(api, 'getLcdx').and.callFake((path: string) => {
      if (path.includes('permission/')) {
        return okResp({qqNumber: 10001, permission: 10});
      }
      return okResp({hasManage: true, permission: 10});
    });

    service.load('LCDXUser');
    expect(api.getLcdx).toHaveBeenCalledTimes(2);

    const state = service.currentValue;
    expect(state.permission).toBe(10);
    expect(state.hasManage).toBeTrue();
    expect(state.loaded).toBeTrue();
  });

  it('accepts the string form of the successful LCDX status code', () => {
    spyOn(api, 'getLcdx').and.callFake((path: string) => {
      if (path.includes('permission/')) {
        return of({status: {code: String(StatusCode.OK), message: 'OK'}, data: {permission: 10}});
      }
      return of({status: {code: String(StatusCode.OK), message: 'OK'}, data: {hasManage: true}});
    });

    service.load('LCDXUser');

    expect(service.currentValue).toEqual({permission: 10, hasManage: true, loaded: true});
  });

  it('keeps defaults when both probes fail', () => {
    spyOn(api, 'getLcdx').and.returnValue(throwError(() => new Error('network down')));
    expect(() => service.load('LCDXUser')).not.toThrow();

    const state = service.currentValue;
    expect(state.permission).toBe(0);
    expect(state.hasManage).toBeFalse();
    expect(state.loaded).toBeFalse();
  });

  it('clear() resets state to zero', () => {
    service.clear();
    const state = service.currentValue;
    expect(state.permission).toBe(0);
    expect(state.hasManage).toBeFalse();
    expect(state.loaded).toBeFalse();
  });

  it('does nothing when userName is empty', () => {
    const spy = spyOn(api, 'getLcdx');
    service.load('');
    expect(spy).not.toHaveBeenCalled();
  });

  // ==================== 角色过滤纯函数（页②③用）====================

  const allCommands = [
    {command: 'ping'}, {command: 'game-reboot'}, {command: 'game-switch'},
    {command: 'printscr'}, {command: 'remote-cmd'}, {command: 'game-force-reboot'},
  ];

  it('filterCommands: normal user gets only game-reboot/game-switch', () => {
    const filtered = BotPermissionService.filterCommands(0, allCommands);
    expect(filtered.map(c => c.command)).toEqual(['game-reboot', 'game-switch']);
  });

  it('filterCommands: admin gets all commands', () => {
    expect(BotPermissionService.filterCommands(10, allCommands).length).toBe(allCommands.length);
  });

  const allKeys = [
    {key: 'event'}, {key: 'chevent'}, {key: 'bd'}, {key: 'hide'},
  ];

  it('filterLcsetKeys: normal user gets only event (sixth-round Q1)', () => {
    const filtered = BotPermissionService.filterLcsetKeys(0, allKeys);
    expect(filtered.map(k => k.key)).toEqual(['event']);
  });

  it('filterLcsetKeys: admin gets all keys', () => {
    expect(BotPermissionService.filterLcsetKeys(10, allKeys).length).toBe(allKeys.length);
  });
});
