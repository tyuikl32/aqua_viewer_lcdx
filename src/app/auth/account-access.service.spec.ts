import {of} from 'rxjs';
import {ApiService} from '../api.service';
import {Account, AccountService} from './account.service';
import {AccountAccessService, AccountAccessStatus} from './account-access.service';

describe('AccountAccessService', () => {
  let api: jasmine.SpyObj<ApiService>;
  let accounts: jasmine.SpyObj<AccountService>;
  let service: AccountAccessService;

  const account: Account = {tokenType: 'Bearer', accessToken: 'access-token', refreshToken: 'refresh-token'};
  const status: AccountAccessStatus = {
    banned: false,
    appeal: 'support'
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    accounts = jasmine.createSpyObj<AccountService>('AccountService', [], {currentAccountValue: account});
    service = new AccountAccessService(api, accounts);
  });

  it('restores account access status from RinNET', async () => {
    api.get.and.returnValue(of({data: status}));

    await expectAsync(service.restore(true)).toBeResolvedTo(status);
    expect(api.get).toHaveBeenCalledOnceWith('api/account/status');
  });

  it('marks the current account as banned after an access error event', () => {
    window.dispatchEvent(new CustomEvent('rinnet-account-access-error', {detail: 'ACCOUNT_BANNED'}));

    expect(service.status).toEqual({banned: true, appeal: 'QQ群 295954906'});
  });
});
