import {of} from 'rxjs';
import {ApiService} from '../api.service';
import {StatusCode} from '../status-code';
import {UserService} from '../user.service';
import {DashboardComponent} from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let api: jasmine.SpyObj<ApiService>;
  let userService: jasmine.SpyObj<UserService>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'getLcdx', 'post']);
    api.getLcdx.and.returnValue(of({status: {code: StatusCode.OK}, data: null}));
    userService = jasmine.createSpyObj<UserService>('UserService', ['load']);
    userService.load.and.resolveTo(null);
    component = new DashboardComponent(
      {} as any,
      api,
      jasmine.createSpyObj('MessageService', ['notice']),
      jasmine.createSpyObj('NgbModal', ['open']),
      {getCurrentLang: () => 'zh'} as any,
      {} as any,
      userService
    );
  });

  it('unbinds the current card and remains on the dashboard in an unbound state', () => {
    api.post.and.returnValue(of({status: {code: StatusCode.OK, message: 'OK'}}));
    api.get.and.returnValue(of({status: {code: StatusCode.NOT_FOUND}}));
    (component as any).currentCardAccessCode = '01234567890123456789';
    const modal = jasmine.createSpyObj('NgbActiveModal', ['close']);

    component.onUnbindCard(modal);

    expect(api.post).toHaveBeenCalledOnceWith('api/user/unbindCard', {accessCode: '01234567890123456789'});
    expect(modal.close).toHaveBeenCalled();
    expect(userService.load).toHaveBeenCalledOnceWith(true);
    expect(component.noCard).toBeTrue();
    expect(component.loadingProfiles).toBeFalse();
  });
});
