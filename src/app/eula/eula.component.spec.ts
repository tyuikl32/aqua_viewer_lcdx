import {CommonModule} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {Router} from '@angular/router';
import {AccountAccessService, EulaDocument} from '../auth/account-access.service';
import {AuthenticationService} from '../auth/authentication.service';
import {UserService} from '../user.service';
import {EulaComponent} from './eula.component';

describe('EulaComponent', () => {
  let fixture: ComponentFixture<EulaComponent>;
  let access: jasmine.SpyObj<AccountAccessService>;

  const currentEula: EulaDocument = {
    id: 1,
    version: 1,
    title: 'RinNET 最终用户许可协议',
    content: '# 协议正文',
    publishedAt: '2026-08-09T22:46:51Z',
    draft: false
  };

  beforeEach(async () => {
    access = jasmine.createSpyObj<AccountAccessService>('AccountAccessService', ['restore', 'currentEula', 'accept']);
    access.restore.and.resolveTo({
      banned: false,
      eulaRequired: true,
      currentEulaVersion: 1,
      acceptedEulaVersion: null,
      appeal: 'QQ群 295954906'
    });

    await TestBed.configureTestingModule({
      imports: [CommonModule],
      declarations: [EulaComponent],
      providers: [
        {provide: AccountAccessService, useValue: access},
        {provide: AuthenticationService, useValue: {logout: jasmine.createSpy('logout')}},
        {provide: UserService, useValue: {load: jasmine.createSpy('load')}},
        {provide: Router, useValue: {navigate: jasmine.createSpy('navigate').and.resolveTo(true)}}
      ]
    }).compileComponents();
  });

  it('renders the current EULA after it loads', async () => {
    access.currentEula.and.resolveTo(currentEula);
    fixture = TestBed.createComponent(EulaComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(currentEula.title);
    expect(fixture.nativeElement.textContent).toContain('协议正文');
  });

  it('shows a retry action when the EULA cannot be loaded', async () => {
    access.currentEula.and.rejectWith(new Error('network error'));
    fixture = TestBed.createComponent(EulaComponent);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('无法加载最终用户许可协议');
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('重新加载');
  });
});
