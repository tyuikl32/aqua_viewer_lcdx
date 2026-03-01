import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Maimai2ServerMissionsComponent } from './maimai2-server-missions.component';

describe('Maimai2ServerMissionsComponent', () => {
  let component: Maimai2ServerMissionsComponent;
  let fixture: ComponentFixture<Maimai2ServerMissionsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Maimai2ServerMissionsComponent]
    });
    fixture = TestBed.createComponent(Maimai2ServerMissionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
