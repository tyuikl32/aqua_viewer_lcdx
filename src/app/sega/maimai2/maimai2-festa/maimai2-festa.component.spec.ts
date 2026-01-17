import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Maimai2FestaComponent } from './maimai2-festa.component';

describe('Maimai2FestaComponent', () => {
  let component: Maimai2FestaComponent;
  let fixture: ComponentFixture<Maimai2FestaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Maimai2FestaComponent]
    });
    fixture = TestBed.createComponent(Maimai2FestaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
