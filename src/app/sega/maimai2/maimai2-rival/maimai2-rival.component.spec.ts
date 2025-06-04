import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Maimai2RivalComponent } from './maimai2-rival.component';

describe('Maimai2RivalComponent', () => {
  let component: Maimai2RivalComponent;
  let fixture: ComponentFixture<Maimai2RivalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Maimai2RivalComponent]
    });
    fixture = TestBed.createComponent(Maimai2RivalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
