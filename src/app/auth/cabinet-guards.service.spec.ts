import {TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {RouterTestingModule} from '@angular/router/testing';
import {AccountService} from './account.service';
import {BotPermissionService} from '../bot-permission.service';
import {MessageService} from '../message.service';
import {CabinetAdminGuard, CabinetManageGuard} from './cabinet-guards.service';

describe('CabinetManageGuard', () => {
  let guard: CabinetManageGuard;
  let adminGuard: CabinetAdminGuard;
  let router: Router;
  let accountService: AccountService;
  let botPermission: BotPermissionService;
  let messageService: jasmine.SpyObj<MessageService>;

  // 属性态用闭包 getter 提供可变默认值，规避 createSpyObj 属性对象与 spyOnProperty 的重复注册问题
  let loggedIn = true;
  let permState = {permission: 0, hasManage: false, loaded: true};

  const perm = (permission: number, hasManage: boolean, loaded: boolean) => {
    permState = {permission, hasManage, loaded};
  };

  beforeEach(() => {
    loggedIn = true;
    permState = {permission: 0, hasManage: false, loaded: true};
    accountService = {
      get currentAccountValue() {
        return loggedIn ? {tokenType: 'Bearer', accessToken: 't'} as any : null;
      }
    } as unknown as AccountService;
    botPermission = {
      get currentValue() {
        return permState;
      }
    } as unknown as BotPermissionService;
    messageService = jasmine.createSpyObj<MessageService>('MessageService', ['notice']);

    TestBed.configureTestingModule({
      imports: [RouterTestingModule.withRoutes([])],
      providers: [
        {provide: AccountService, useValue: accountService},
        {provide: BotPermissionService, useValue: botPermission},
        {provide: MessageService, useValue: messageService},
      ]
    });
    guard = TestBed.inject(CabinetManageGuard);
    adminGuard = TestBed.inject(CabinetAdminGuard);
    router = TestBed.inject(Router);
  });

  it('redirects to home when not logged in', () => {
    loggedIn = false;
    const result = guard.canActivate({} as any, {} as any);
    expect((result as any).toString()).toBe('/');
  });

  it('allows pass-through while permission probe has not finished (loaded=false)', () => {
    perm(0, false, false);
    expect(guard.canActivate({} as any, {} as any)).toBeTrue();
    expect(adminGuard.canActivate({} as any, {} as any)).toBeTrue();
  });

  it('blocks and notifies when hasManage=false (EP-18 denied)', () => {
    perm(0, false, true);
    const result = guard.canActivate({} as any, {} as any);
    expect((result as any).toString()).toBe('/dashboard');
    expect(messageService.notice).toHaveBeenCalled();
  });

  it('allows when hasManage=true', () => {
    perm(0, true, true);
    expect(guard.canActivate({} as any, {} as any)).toBeTrue();
  });

  it('admin guard blocks permission<10 even with hasManage=true (locks page, P>=10)', () => {
    perm(5, true, true);
    const result = adminGuard.canActivate({} as any, {} as any);
    expect((result as any).toString()).toBe('/dashboard');
    expect(messageService.notice).toHaveBeenCalled();
  });

  it('admin guard allows permission>=10', () => {
    perm(10, true, true);
    expect(adminGuard.canActivate({} as any, {} as any)).toBeTrue();
  });
});