import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Maimai2KopRankingComponent } from './maimai2-kop-ranking.component';

describe('Maimai2KopRankingComponent', () => {
  let component: Maimai2KopRankingComponent;
  let fixture: ComponentFixture<Maimai2KopRankingComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [Maimai2KopRankingComponent]
    });
    fixture = TestBed.createComponent(Maimai2KopRankingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
