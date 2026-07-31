import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslatePipe } from '@ngx-translate/core';

import { KeychipComponent } from './keychip.component';

describe('KeychipComponent', () => {
  let component: KeychipComponent;
  let fixture: ComponentFixture<KeychipComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [KeychipComponent],
      imports: [ReactiveFormsModule, TranslatePipe],
      providers: [provideTranslateService()],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    });
    fixture = TestBed.createComponent(KeychipComponent);
    component = fixture.componentInstance;
    spyOn(component, 'loadKeychip');
    spyOn(component, 'loadTrustedKeychip');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
