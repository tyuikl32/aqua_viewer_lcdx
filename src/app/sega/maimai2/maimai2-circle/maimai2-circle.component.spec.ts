import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Maimai2CircleComponent } from './maimai2-circle.component';

describe('Maimai2CircleComponent', () => {
  let component: Maimai2CircleComponent;
  let fixture: ComponentFixture<Maimai2CircleComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Maimai2CircleComponent]
    });
    fixture = TestBed.createComponent(Maimai2CircleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
