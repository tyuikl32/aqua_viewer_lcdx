import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {ImpersonationService} from '../auth/impersonation.service';
import {ImpersonationAdminToolbarComponent} from './impersonation-admin-toolbar.component';

describe('ImpersonationAdminToolbarComponent', () => {
  let fixture: ComponentFixture<ImpersonationAdminToolbarComponent>;
  const impersonation = {
    active: true,
    adminContext: {target: 'target-user'},
    requestAdminAction: jasmine.createSpy('requestAdminAction').and.resolveTo({account: {cards: []}}),
  };

  beforeEach(async () => {
    impersonation.requestAdminAction.calls.reset();
    impersonation.requestAdminAction.and.resolveTo({account: {cards: []}});
    await TestBed.configureTestingModule({
      declarations: [ImpersonationAdminToolbarComponent],
      imports: [FormsModule],
      providers: [{provide: ImpersonationService, useValue: impersonation}],
    }).compileComponents();

    fixture = TestBed.createComponent(ImpersonationAdminToolbarComponent);
    fixture.detectChanges();
  });

  it('keeps the component host sticky below the fixed navbar', () => {
    const styles = getComputedStyle(fixture.nativeElement);

    expect(styles.position).toBe('sticky');
    expect(styles.top).toBe('57.6px');
  });

  it('uses the active Bootstrap theme variables for its surface', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.style.setProperty('--bs-body-color', 'rgb(10, 20, 30)');
    host.style.setProperty('--bs-body-bg', 'rgb(40, 50, 60)');
    host.style.setProperty('--bs-border-color', 'rgb(70, 80, 90)');
    host.style.setProperty('--bs-border-width', '2px');

    const toolbar = host.querySelector('.admin-toolbar') as HTMLElement;
    const styles = getComputedStyle(toolbar);

    expect(styles.color).toBe('rgb(10, 20, 30)');
    expect(styles.backgroundColor).toBe('rgb(40, 50, 60)');
    expect(styles.borderBottomColor).toBe('rgb(70, 80, 90)');
    expect(styles.borderBottomWidth).toBe('2px');
  });

  it('aligns its content with the modal header using Bootstrap spacing', () => {
    const toolbar = fixture.nativeElement.querySelector('.admin-toolbar') as HTMLElement;

    expect(toolbar.classList).toContain('px-3');
    expect(toolbar.classList).toContain('py-2');
    expect(toolbar.classList).not.toContain('p-2');
    expect(getComputedStyle(toolbar).paddingLeft).toBe('16px');
  });

  it('loads and manually refreshes the admin context without a success message', async () => {
    await fixture.whenStable();
    expect(fixture.componentInstance.message).toBe('');

    fixture.componentInstance.message = '卡片 123 已绑定';
    await fixture.componentInstance.refresh();

    expect(fixture.componentInstance.message).toBe('');
    expect(impersonation.requestAdminAction).toHaveBeenCalledWith('refresh-admin-context', {});
  });

  it('shows specific feedback after a write operation succeeds', async () => {
    await fixture.componentInstance.run('bind-card-by-ext-id', {extId: 12345678});
    fixture.detectChanges();

    expect(fixture.componentInstance.message).toBe('卡片 12345678 已绑定');
    expect(fixture.nativeElement.querySelector('[role="status"].text-success').textContent)
      .toContain('卡片 12345678 已绑定');
  });

  it('keeps refresh errors visible', async () => {
    impersonation.requestAdminAction.and.rejectWith(new Error('刷新失败'));

    await fixture.componentInstance.refresh();
    fixture.detectChanges();

    expect(fixture.componentInstance.message).toBe('刷新失败');
    expect(fixture.nativeElement.querySelector('[role="alert"].text-danger').textContent)
      .toContain('刷新失败');
  });

  it('disables write actions until their required inputs are valid', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

    expect(buttons.filter(button => button.textContent?.trim() !== '刷新').every(button => button.disabled)).toBeTrue();

    const extIdInput = fixture.nativeElement.querySelector('input[placeholder="ExtId"]') as HTMLInputElement;
    extIdInput.value = '12345678';
    extIdInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const updatedButtons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

    expect(fixture.componentInstance.extIdValue).toBe(12345678);
    expect(fixture.componentInstance.pending).toBeFalse();
    expect(updatedButtons.find(button => button.textContent?.trim() === '绑定')?.disabled).toBeFalse();
    expect(updatedButtons.find(button => button.textContent?.trim() === '删除外部码')?.disabled).toBeTrue();
  });

  it('does not let an older refresh overwrite a newer write result', async () => {
    await fixture.whenStable();
    let resolveRefresh!: (value: any) => void;
    let resolveWrite!: (value: any) => void;
    const refreshResult = new Promise(resolve => resolveRefresh = resolve);
    const writeResult = new Promise(resolve => resolveWrite = resolve);
    impersonation.requestAdminAction.and.returnValues(refreshResult, writeResult);

    const refresh = fixture.componentInstance.refresh();
    const write = fixture.componentInstance.run('bind-card-by-ext-id', {extId: 12345678});
    resolveWrite({account: {cards: [{extId: 12345678}]}});
    await write;
    resolveRefresh({account: {cards: []}});
    await refresh;

    expect(fixture.componentInstance.data.account.cards).toEqual([{extId: 12345678}]);
    expect(fixture.componentInstance.message).toBe('卡片 12345678 已绑定');
  });

  it('allows fields to shrink before the toolbar wraps on narrow viewports', () => {
    const field = fixture.nativeElement.querySelector('.field') as HTMLElement;
    const styles = getComputedStyle(field);

    expect(styles.flexShrink).toBe('1');
    expect(styles.minWidth).toBe('0px');
  });
});
