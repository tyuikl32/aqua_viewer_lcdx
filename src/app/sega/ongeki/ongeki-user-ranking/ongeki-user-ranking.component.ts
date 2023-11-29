import { Component, OnInit } from '@angular/core';
import {MatTableDataSource} from '@angular/material/table';
import {OngekiUserRanking} from '../model/OngekiUserRanking';
import {ApiService} from '../../../api.service';

@Component({
  selector: 'app-ongeki-user-ranking',
  templateUrl: './ongeki-user-ranking.component.html',
  styleUrls: ['./ongeki-user-ranking.component.css']
})
export class OngekiUserRankingComponent implements OnInit {
  ongekiUserRankings: OngekiUserRanking[] = [];

  constructor(private api: ApiService) { }

  ngOnInit(): void {
    this.getData();
  }

  private getData() {
    this.api.get('api/game/ongeki/data/userRatingRanking')
      .subscribe(data => {
        this.ongekiUserRankings = data;
      });
  }
}