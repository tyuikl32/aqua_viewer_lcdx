import {Location} from '@angular/common';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideTranslateService, TranslatePipe} from '@ngx-translate/core';

import {NotFoundComponent} from './not-found.component';

describe('NotFoundComponent', () => {
  let component: NotFoundComponent;
  let fixture: ComponentFixture<NotFoundComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NotFoundComponent],
      imports: [TranslatePipe],
      providers: [Location, provideTranslateService()],
    });
    fixture = TestBed.createComponent(NotFoundComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
