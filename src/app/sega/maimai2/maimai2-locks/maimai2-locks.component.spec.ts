import { CUSTOM_ELEMENTS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ApiService } from '../../../api.service';
import { BotPermissionService } from '../../../bot-permission.service';
import { MessageService } from '../../../message.service';
import { UserService } from '../../../user.service';
import { Maimai2LocksComponent } from './maimai2-locks.component';

@Pipe({name: 'translate', standalone: false})
class TranslatePipeStub implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('Maimai2LocksComponent', () => {
  let fixture: ComponentFixture<Maimai2LocksComponent>;
  // 属性态用闭包 getter 提供可变默认值（quality-guidelines 服务 stub 模式）
  let permState = {permission: 10, qqNumber: 10001, hasManage: true, loaded: true};

  beforeEach(async () => {
    permState = {permission: 10, qqNumber: 10001, hasManage: true, loaded: true};
    await TestBed.configureTestingModule({
      declarations: [Maimai2LocksComponent, TranslatePipeStub],
      imports: [FormsModule, NgxPaginationModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
      providers: [
        {
          provide: ApiService,
          useValue: {
            getLcdx: () => of({status: {code: 92001}, data: []}),
            postLcdx: () => of({status: {code: 92001}, data: {}}),
            deleteLcdx: () => of({status: {code: 92001}, data: {}}),
          }
        },
        {
          provide: UserService,
          useValue: {currentUser: {username: 'admin'}}
        },
        {
          provide: MessageService,
          useValue: {notice: jasmine.createSpy('notice')}
        },
        {
          provide: BotPermissionService,
          useValue: {
            get currentValue() {
              return permState;
            }
          }
        },
        {
          provide: TranslateService,
          useValue: {instant: (key: string, params?: object) => key}
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Maimai2LocksComponent);
    fixture.detectChanges();
  });

  it('enables Add Grant after entering a QQ number and selecting a cabinet', async () => {
    const component = fixture.componentInstance;
    component.cabinets = [{
      nickName: 'test-cabinet',
      fullKeychip: 'A63E-01000000000',
      locationName: null,
      isSpecialMode: 0,
      level: 0,
      isRebooting: false,
      lastOnline: '2026-08-19T00:00:00',
    }];
    fixture.detectChanges();

    const inputs = fixture.nativeElement.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
    const cabinetSelect = fixture.nativeElement.querySelectorAll('select')[1] as HTMLSelectElement;
    const addButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.classList.contains('btn-success')) as HTMLButtonElement;

    inputs[1].value = '123456789';
    inputs[1].dispatchEvent(new Event('input'));
    cabinetSelect.value = cabinetSelect.options[1].value;
    cabinetSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.grantQQ).toBe(123456789);
    expect(component.grantNick).toBe('test-cabinet');
    expect(addButton.disabled).toBeFalse();
  });

  it('filters grants locally by QQ prefix from the search input (empty shows all)', async () => {
    const component = fixture.componentInstance;
    component.grants = [
      {qqNumber: 123456789, fullKeychip: 'A63E-01000000000', nickName: 'cab-a', enabled: true, grantedAt: '2026-08-19T00:00:00', grantedBy: 10001},
      {qqNumber: 987654321, fullKeychip: 'A63E-02000000000', nickName: null, enabled: true, grantedAt: '2026-08-19T00:00:00', grantedBy: 20002},
    ];
    fixture.detectChanges();
    const grantsTbody = fixture.nativeElement.querySelectorAll('tbody')[1];
    expect(grantsTbody.querySelectorAll('tr').length).toBe(2);

    const inputs = fixture.nativeElement.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
    inputs[2].value = '123';
    inputs[2].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.grantSearchQQ).toBe(123);
    expect(component.filteredGrants.map(g => g.qqNumber)).toEqual([123456789]);
    expect(grantsTbody.querySelectorAll('tr').length).toBe(1);

    inputs[2].value = '';
    inputs[2].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.grantSearchQQ).toBeNull();
    expect(component.filteredGrants.length).toBe(2);
    expect(grantsTbody.querySelectorAll('tr').length).toBe(2);
  });

  it('shows the Admin permission card (P>=7) with level options 0..own permission only', async () => {
    const component = fixture.componentInstance;
    expect(component.permission).toBe(10);

    const selects = fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
    const permSelect = selects[2];
    expect(permSelect).toBeTruthy();
    // 选项 0..10 共 11 项（只能授权别人 ≤ 自己）
    expect(permSelect.options.length).toBe(11);

    const inputs = fixture.nativeElement.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
    inputs[3].value = '10086';
    inputs[3].dispatchEvent(new Event('input'));
    permSelect.value = permSelect.options[4].value;
    permSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.permQQ).toBe(10086);
    expect(component.permLevel).toBe(4);
    const setButton = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button: HTMLButtonElement) => button.textContent?.trim() === 'Maimai2.LocksPage.SetPermission') as HTMLButtonElement;
    expect(setButton).toBeTruthy();
    expect(setButton.disabled).toBeFalse();
  });
});
