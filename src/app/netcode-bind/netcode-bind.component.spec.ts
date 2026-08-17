import {FormBuilder} from '@angular/forms';
import {Router} from '@angular/router';
import {of} from 'rxjs';
import {ApiService} from '../api.service';
import {UserService} from '../user.service';
import {NetcodeBindComponent} from './netcode-bind.component';

describe('NetcodeBindComponent', () => {
  let component: NetcodeBindComponent;
  let api: jasmine.SpyObj<ApiService>;
  let userService: jasmine.SpyObj<UserService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['getLcdx']);
    userService = jasmine.createSpyObj<UserService>('UserService', ['load']);
    userService.currentUser = {username: 'user', cards: []} as any;
    userService.load.and.resolveTo({status: {code: 92001}});
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    component = new NetcodeBindComponent(
      api,
      new FormBuilder(),
      userService,
      router,
      jasmine.createSpyObj('MessageService', ['notice'])
    );
  });

  it('does not force an unbound user back to the dashboard', async () => {
    await component.loadCards();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.loaded).toBeTrue();
  });

  it('returns to the dashboard after a successful binding', () => {
    api.getLcdx.and.returnValue(of({status: {code: 92001, message: 'OK'}}));
    component.netCodeForm.setValue({netCode: '123456'});

    component.onClick();

    expect(api.getLcdx).toHaveBeenCalledOnceWith('lcdx/bind/user/123456');
    expect(router.navigate).toHaveBeenCalledOnceWith(['/dashboard']);
  });
});
