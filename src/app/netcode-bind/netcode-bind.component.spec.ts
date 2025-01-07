import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NetcodeBindComponent } from './netcode-bind.component';

describe('NetcodeBindComponent', () => {
  let component: NetcodeBindComponent;
  let fixture: ComponentFixture<NetcodeBindComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [NetcodeBindComponent]
    });
    fixture = TestBed.createComponent(NetcodeBindComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
