import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { UserService } from './user.service';
import { ApiService } from './api.service';
import { AccountService } from './auth/account.service';
import { MessageService } from './message.service';
import { BotPermissionService } from './bot-permission.service';
import { StatusCode } from './status-code';

describe('UserService', () => {
  let service: UserService;
  let api: jasmine.SpyObj<ApiService>;
  let botPermission: jasmine.SpyObj<BotPermissionService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    botPermission = jasmine.createSpyObj<BotPermissionService>('BotPermissionService', ['load', 'clear']);
    TestBed.configureTestingModule({
      providers: [
        {provide: ApiService, useValue: api},
        {provide: AccountService, useValue: {currentAccountValue: {accessToken: 'token'}}},
        {provide: MessageService, useValue: jasmine.createSpyObj<MessageService>('MessageService', ['notice'])},
        {provide: BotPermissionService, useValue: botPermission},
      ]
    });
    service = TestBed.inject(UserService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts LCDX permission probes after loading the authenticated user', async () => {
    api.get.and.returnValue(of({
      status: {code: StatusCode.OK, message: 'OK'},
      data: {username: 'LCDXUser', cards: []}
    }));

    await service.load(true);

    expect(botPermission.load).toHaveBeenCalledOnceWith('LCDXUser');
  });
});
