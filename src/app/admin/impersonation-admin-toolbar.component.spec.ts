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
});
