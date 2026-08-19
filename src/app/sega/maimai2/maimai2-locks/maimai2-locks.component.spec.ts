import { CUSTOM_ELEMENTS_SCHEMA, Pipe, PipeTransform } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
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

  beforeEach(async () => {
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
          useValue: {isAdmin: true}
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
});
