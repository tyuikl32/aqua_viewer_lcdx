import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Maimai2PointExchangesComponent } from './maimai2-point-exchanges.component.js';

describe('Maimai2PointExchangesComponent', () => {
  let component: Maimai2PointExchangesComponent;
  let fixture: ComponentFixture<Maimai2PointExchangesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Maimai2PointExchangesComponent]
    });
    fixture = TestBed.createComponent(Maimai2PointExchangesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
