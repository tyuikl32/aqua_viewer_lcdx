import { CUSTOM_ELEMENTS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, of } from 'rxjs';
import { ApiService } from '../../../api.service';
import { BotPermissionService, LcdxPermissionState } from '../../../bot-permission.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';
import { Maimai2RemoteControlComponent } from './maimai2-remote-control.component';

@Pipe({name: 'translate', standalone: false})
class TranslatePipeStub implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('Maimai2RemoteControlComponent', () => {
  let fixture: ComponentFixture<Maimai2RemoteControlComponent>;
  let permissionState: BehaviorSubject<LcdxPermissionState>;

  beforeEach(async () => {
    permissionState = new BehaviorSubject<LcdxPermissionState>({
      permission: 0,
      qqNumber: null,
      hasManage: true,
      loaded: false,
    });

    const botPermission = {
      state: permissionState.asObservable(),
      get currentValue() {
        return permissionState.value;
      },
      get isAdmin() {
        return permissionState.value.permission >= BotPermissionService.ADMIN_PERMISSION;
      },
    } as unknown as BotPermissionService;

    await TestBed.configureTestingModule({
      declarations: [Maimai2RemoteControlComponent, TranslatePipeStub],
      imports: [CommonModule, FormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: ApiService,
          useValue: {
            getLcdx: () => of({status: {code: 92001}, data: []}),
            postLcdx: () => of({status: {code: 92001}, data: {}}),
          },
        },
        {provide: UserService, useValue: {currentUser: {username: 'LCDXUser'}}},
        {provide: MessageService, useValue: {notice: jasmine.createSpy('notice')}},
        {provide: BotPermissionService, useValue: botPermission},
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Maimai2RemoteControlComponent);
    fixture.detectChanges();
  });

  it('updates the command list when the delayed permission probe returns admin access', () => {
    const component = fixture.componentInstance;
    expect(component['commands'].map(command => command.command)).toEqual(['game-reboot', 'game-switch']);

    permissionState.next({permission: 10, qqNumber: 3413607143, hasManage: true, loaded: true});
    fixture.detectChanges();

    expect(component['commands'].some(command => command.command === 'remote-cmd')).toBeTrue();
  });
});
