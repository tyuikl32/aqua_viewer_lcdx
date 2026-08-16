import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {environment} from '../../../../environments/environment';
import {ApiService} from '../../../api.service';
import {KOPRankings} from '../model/Maimai2Profile';

@Component({
  selector: 'app-maimai2-kop-ranking',
  templateUrl: './maimai2-kop-ranking.component.html',
  styleUrls: ['./maimai2-kop-ranking.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class Maimai2KopRankingComponent implements OnInit {
  kopRankings: KOPRankings[] = [];
  host = environment.maiAssetsHost;

  constructor(private api: ApiService) { }

  ngOnInit(): void {
    this.getRanking();
  }

  private getRanking() {
    this.api.getLcdx('lcdx/kop/rank')
      .subscribe(data => {
        this.kopRankings = data;
      });
  }

}
