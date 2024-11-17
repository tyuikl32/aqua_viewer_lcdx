import { Component } from '@angular/core';
import {V2UserRanking} from '../../chunithm/v2/model/V2UserRanking';
import {V2PcRanking} from '../../chunithm/v2/model/V2PcRanking';
import {environment} from '../../../../environments/environment';
import {ApiService} from '../../../api.service';
import {error} from 'protractor';
import {KOPRankings} from '../model/Maimai2Profile';

@Component({
  selector: 'app-maimai2-kop-ranking',
  templateUrl: './maimai2-kop-ranking.component.html',
  styleUrls: ['./maimai2-kop-ranking.component.scss']
})
export class Maimai2KopRankingComponent {
  kopRankings: KOPRankings[] = [];
  host = environment.assetsHost;

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
