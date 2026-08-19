import { CUSTOM_ELEMENTS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Maimai2SettingComponent } from './maimai2-setting.component';
import { ApiService } from '../../../api.service';
import { AccountService } from '../../../auth/account.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';

@Pipe({name: 'translate', standalone: false})
class TranslatePipeStub implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('Maimai2SettingComponent', () => {
  let component: Maimai2SettingComponent;
  let fixture: ComponentFixture<Maimai2SettingComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [Maimai2SettingComponent, TranslatePipeStub],
      imports: [ReactiveFormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: ApiService,
          useValue: {
            get: () => of({}),
            getLcdx: () => of({status: {code: 92001}, data: {isOnRequest: false}}),
            postLcdx: () => of({status: {code: 92001}, data: {}}),
          }
        },
        {provide: AccountService, useValue: {currentAccountValue: {accessToken: 'test'}}},
        {provide: HttpClient, useValue: {}},
        {provide: MessageService, useValue: {notice: jasmine.createSpy('notice')}},
        {provide: UserService, useValue: {currentUser: {username: 'test', defaultCard: {extId: 1, luid: '24304430670000000000'}, cards: [{luid: '24304430670000000000'}]}}},
        {provide: TranslateService, useValue: {instant: (key: string) => key}}
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(Maimai2SettingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
