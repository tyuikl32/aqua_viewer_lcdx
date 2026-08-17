import {HttpBackend, HttpHandler, HttpRequest, HttpResponse} from '@angular/common/http';
import {BehaviorSubject, of} from 'rxjs';
import {environment} from '../../environments/environment';
import {Account, AccountService} from './account.service';
import {TokenInterceptorService} from './token-interceptor.service';

describe('TokenInterceptorService', () => {
  let service: TokenInterceptorService;
  let account: Account;
  let accountService: jasmine.SpyObj<AccountService> & {currentAccount: BehaviorSubject<Account>};

  beforeEach(() => {
    account = {tokenType: 'Bearer', accessToken: 'access-token', refreshToken: 'refresh-token'};
    accountService = jasmine.createSpyObj<AccountService>('AccountService', [], {
      currentAccountValue: account
    }) as jasmine.SpyObj<AccountService> & {currentAccount: BehaviorSubject<Account>};
    accountService.currentAccount = new BehaviorSubject<Account>(account);
    service = new TokenInterceptorService(accountService, {} as HttpBackend);
  });

  it('attaches the account token to LCDX requests', () => {
    const next = jasmine.createSpyObj<HttpHandler>('HttpHandler', ['handle']);
    next.handle.and.returnValue(of(new HttpResponse({status: 200})));

    service.intercept(new HttpRequest('GET', `${environment.lcdxApiServer}lcdx/getBindAccessCode/12345678901234567890`), next).subscribe();

    const forwarded = next.handle.calls.mostRecent().args[0] as HttpRequest<unknown>;
    expect(forwarded.headers.get('Authorization')).toBe('Bearer access-token');
  });

  it('does not attach the account token to unrelated origins', () => {
    const next = jasmine.createSpyObj<HttpHandler>('HttpHandler', ['handle']);
    next.handle.and.returnValue(of(new HttpResponse({status: 200})));

    service.intercept(new HttpRequest('GET', 'https://example.com/resource'), next).subscribe();

    const forwarded = next.handle.calls.mostRecent().args[0] as HttpRequest<unknown>;
    expect(forwarded.headers.has('Authorization')).toBeFalse();
  });
});
