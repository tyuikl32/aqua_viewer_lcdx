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

  // 生成卡B 授权行（qqBase + i 保证 qq/track 唯一）
  const makeGrants = (count: number, qqBase: number) =>
    Array.from({length: count}, (_, i) => ({
      qqNumber: qqBase + i,
      fullKeychip: `A63E-${String(i).padStart(12, '0')}`,
      nickName: null,
      enabled: true,
      grantedAt: '2026-08-19T00:00:00',
      grantedBy: 10001,
    }));

  // 生成卡A 操作记录行（服务端分页：locks 为当前页切片，total 为服务端总数）
  const makeLocks = (count: number) =>
    Array.from({length: count}, (_, i) => ({
      time: `2026-08-19T00:${String(i % 60).padStart(2, '0')}:00`,
      qqNumber: 10000 + i,
      action: 'lcset',
      fullKeychip: 'A63E-01000000000',
      params: null,
      result: 'success',
      detail: null,
    }));

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

  it('slices pagedGrants client-side (25 grants, pageSize 20 → page 1 has 20, page 2 has 5)', () => {
    const component = fixture.componentInstance;
    component.grants = makeGrants(25, 123000000);
    component.grantPage = 1;
    fixture.detectChanges();

    expect(component.pagedGrants.length).toBe(20);
    expect(component.pagedGrants[0].qqNumber).toBe(123000000);
    expect(component.pagedGrants[19].qqNumber).toBe(123000019);

    component.grantPageChanged(2);
    fixture.detectChanges();

    expect(component.pagedGrants.length).toBe(5);
    expect(component.pagedGrants[0].qqNumber).toBe(123000020);
    expect(component.pagedGrants[4].qqNumber).toBe(123000024);
  });

  it('resets grantPage to 1 when the page size select changes', async () => {
    const component = fixture.componentInstance;
    component.grants = makeGrants(25, 123000000);
    component.grantPage = 2;
    fixture.detectChanges();
    expect(component.pagedGrants.length).toBe(5);

    // 卡B 每页条数下拉：selects[0]=卡A操作类型 [1]=卡B机台 [2]=卡B每页条数 [3]=卡C等级
    const pageSizeSelect = fixture.nativeElement.querySelectorAll('select')[2] as HTMLSelectElement;
    pageSizeSelect.value = pageSizeSelect.options[0].value; // 10
    pageSizeSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.grantPageSize).toBe(10);
    expect(component.grantPage).toBe(1);
    expect(component.pagedGrants.length).toBe(10);
  });

  it('combines the QQ prefix filter with pagination (page resets to 1 on filter change)', async () => {
    const component = fixture.componentInstance;
    component.grants = [...makeGrants(20, 123000000), ...makeGrants(5, 987000000)];
    component.grantPage = 2;
    fixture.detectChanges();
    const grantsTbody = fixture.nativeElement.querySelectorAll('tbody')[1];
    expect(grantsTbody.querySelectorAll('tr').length).toBe(5); // 第 2 页为 987… 前缀行

    const inputs = fixture.nativeElement.querySelectorAll('input[type="number"]') as NodeListOf<HTMLInputElement>;
    inputs[2].value = '123';
    inputs[2].dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.grantSearchQQ).toBe(123);
    expect(component.grantPage).toBe(1);
    expect(component.filteredGrants.length).toBe(20);
    expect(grantsTbody.querySelectorAll('tr').length).toBe(20);

    // 单页（20 条 / 每页 20）时卡B 分页控件隐藏（autoHide）
    const cardBControls = fixture.nativeElement.querySelectorAll('pagination-controls')[1] as HTMLElement;
    expect(cardBControls.querySelector('ul')).toBeNull();
  });

  it('resets grantPage via loadGrants clamp when the refreshed list shrinks below the page start', () => {
    const component = fixture.componentInstance;
    component.grants = makeGrants(25, 123000000);
    component.grantPage = 2;
    fixture.detectChanges();

    component.loadGrants(); // api stub 返回空清单 → 当前页越界
    fixture.detectChanges();

    expect(component.grants.length).toBe(0);
    expect(component.grantPage).toBe(1);
    expect(component.pagedGrants.length).toBe(0);
  });

  it('renders card B pagination controls and switches pages from the links', async () => {
    const component = fixture.componentInstance;
    component.grants = makeGrants(25, 123000000);
    fixture.detectChanges();
    const grantsTbody = fixture.nativeElement.querySelectorAll('tbody')[1];
    expect(grantsTbody.querySelectorAll('tr').length).toBe(20);

    // 卡B 的 pagination-controls 为页面上第二个（卡A 一个、卡B 一个）
    const controls = fixture.nativeElement.querySelectorAll('pagination-controls')[1];
    expect(controls).toBeTruthy();
    const pageTwoLink = Array.from(controls.querySelectorAll('li a'))
      .find((a: HTMLAnchorElement) => /2$/.test(a.textContent?.trim() ?? '')) as HTMLAnchorElement;
    expect(pageTwoLink).toBeTruthy();

    pageTwoLink.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.grantPage).toBe(2);
    expect(grantsTbody.querySelectorAll('tr').length).toBe(5);
  });

  it('renders card A pagination controls from server total and switches pages from the links', async () => {
    const component = fixture.componentInstance;
    // 服务端分页：当前页切片 20 条，服务端总数 100 → 控件应显示 5 页
    component.locks = makeLocks(20);
    component.total = 100;
    component.page = 1;
    fixture.detectChanges();
    const auditTbody = fixture.nativeElement.querySelectorAll('tbody')[0];
    expect(auditTbody.querySelectorAll('tr').length).toBe(20); // 管道 server 模式透传切片

    // 卡A 的 pagination-controls 为页面上第一个
    const controls = fixture.nativeElement.querySelectorAll('pagination-controls')[0];
    expect(controls).toBeTruthy();
    const ul = controls.querySelector('ul');
    expect(ul).withContext('paired paginate instance must render page links').toBeTruthy();
    // 锚文本带屏幕阅读器前缀（"page 2"）；当前页(1)渲染为 span 非 a → 锚为 2..5 共 4 个
    const anchors = Array.from(controls.querySelectorAll('li a')) as HTMLAnchorElement[];
    const anchorPages = anchors.map(a => a.textContent?.trim() ?? '').filter(t => /^page \d+$/.test(t));
    expect(anchorPages).toEqual(['page 2', 'page 3', 'page 4', 'page 5']);

    const pageThreeLink = anchors.find(a => (a.textContent?.trim() ?? '').endsWith('3')) as HTMLAnchorElement;
    pageThreeLink.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // pageChanged(3)：页码更新并触发重查（stub 返回空清单）
    expect(component.page).toBe(3);
  });

  it('shows the Admin permission card (P>=7) with level options 0..own permission only', async () => {
    const component = fixture.componentInstance;
    expect(component.permission).toBe(10);

    const selects = fixture.nativeElement.querySelectorAll('select') as NodeListOf<HTMLSelectElement>;
    // 卡B 新增每页条数下拉后，等级下拉顺移到第 4 个
    const permSelect = selects[3];
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
