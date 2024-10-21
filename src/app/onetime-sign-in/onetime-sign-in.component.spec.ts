import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OnetimeSignInComponent } from './onetime-sign-in.component';

describe('OnetimeSignInComponent', () => {
  let component: OnetimeSignInComponent;
  let fixture: ComponentFixture<OnetimeSignInComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [OnetimeSignInComponent]
    });
    fixture = TestBed.createComponent(OnetimeSignInComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
