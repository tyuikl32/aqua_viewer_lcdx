import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {AuthenticationService} from './authentication.service';
import {AccountService} from './account.service';
import {AccountAccessService} from './account-access.service';
import {UserService} from '../user.service';
import {StatusCode} from '../status-code';

describe('Service: Authentication', () => {
  let accountService: AccountService;
  let userService: jasmine.SpyObj<UserService>;
  let access: jasmine.SpyObj<AccountAccessService>;
  let router: jasmine.SpyObj<Router>;
  let service: AuthenticationService;

  beforeEach(() => {
    accountService = {currentAccountValue: null} as AccountService;
    userService = jasmine.createSpyObj<UserService>('UserService', ['load']);
    access = jasmine.createSpyObj<AccountAccessService>('AccountAccessService', ['restore']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    access.restore.and.resolveTo({
      banned: false,
      appeal: 'support'
    });
    service = new AuthenticationService(accountService, {} as HttpClient, userService, access, router);
  });

  it('redirects an unbound user to NetCode binding once during login', async () => {
    userService.currentUser = {cards: []} as any;
    userService.load.and.resolveTo({status: {code: StatusCode.OK}});
    const response = {status: {code: StatusCode.OK}, data: {accessToken: 'token'}};

    await service.procLoginResp(response);

    expect(accountService.currentAccountValue).toBe(response.data as any);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/netcode-bind']);
  });

  it('does not redirect a bound user from the shared login processor', async () => {
    userService.currentUser = {cards: [{id: 1}]} as any;
    userService.load.and.resolveTo({status: {code: StatusCode.OK}});

    await service.procLoginResp({status: {code: StatusCode.OK}, data: {accessToken: 'token'}});

    expect(router.navigate).not.toHaveBeenCalled();
  });
});
