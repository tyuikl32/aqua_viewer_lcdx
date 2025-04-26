import {Component, Input} from '@angular/core';
import { ApiService } from '../../../api.service';
import { MessageService } from '../../../message.service';
import {OngekiMusic} from '../model/OngekiMusic';
import {environment} from '../../../../environments/environment';
import {NgbOffcanvas} from '@ng-bootstrap/ng-bootstrap';
import {HttpParams} from '@angular/common/http';
import { UserService } from 'src/app/user.service';
import {NgxIndexedDBService} from 'ngx-indexed-db';
import {OngekiCard} from '../model/OngekiCard';
import {TranslateService} from '@ngx-translate/core';

interface Ranking {
  level?: number;
  username: string;
  score: number;
}

interface ISongData {
  musicId: number;
  level: number;
  playCount: number;
  techScoreMax: number;
  techScoreRank: number;
  battleScoreMax: number;
  battleScoreRank: number;
  platinumScoreMax: number;
  maxComboCount: number;
  maxOverKill: number;
  maxTeamOverKill: number;
  clearStatus: number;
  storyWatched: boolean;
  isFullBell: boolean;
  isFullCombo: boolean;
  isAllBreake: boolean;
  isLock: boolean;
  ranking: UserRanking;
}

interface UserRanking {
  rank: number;
  playedCount: number;
}

@Component({
  selector: 'app-ongeki-song-score-ranking',
  templateUrl: './ongeki-song-score-ranking.component.html',
  styleUrls: ['./ongeki-song-score-ranking.component.css', ]
})
export class OngekiSongScoreRankingComponent {
  protected readonly Math = Math;
  ranking: Ranking[];
  songData: {[key: number]: ISongData};
  loadingSongData = true;
  host = environment.assetsHost;
  protected readonly parseFloat = parseFloat;
  @Input() public music: OngekiMusic;
  protected bossCard: OngekiCard;
  constructor(
    private dbService: NgxIndexedDBService,
    private api: ApiService,
    private userService: UserService,
    private translate: TranslateService,
    public messageService: MessageService,
    public offcanvasService: NgbOffcanvas,
  ) {
  }

  ngOnInit() {
    this.dbService.getByID<OngekiCard>('ongekiCard', this.music.bossCardId).subscribe((x) => {
      this.bossCard = x;
    });

    const { id } = this.music;
    this.api.get(`api/game/ongeki/song/${id}?aimeId=${String(this.userService.currentUser.defaultCard.extId)}`).subscribe({
      next: (res) => {
        const songData = {};
        for (const data of res) {
          songData[data.level] = data;
        }
        this.songData = songData;
        this.loadingSongData = false;
      },
      error: (err) => {
        this.translate.get('Common.FailedToLoad').subscribe((res: string) => {
          this.messageService.notice(res, 'danger');
        });
        this.loadingSongData = false;
      }
    }
    );

    if (!this.isLunatic(this.music)){
      const param = new HttpParams().set('musicId', id).set('level', 3);
      this.api.get('api/game/ongeki/musicScoreRanking', param).subscribe((res) => {
        this.ranking = res;
      });
    }
    else{
      const param = new HttpParams().set('musicId', id).set('level', 10);
      this.api.get('api/game/ongeki/musicScoreRanking', param).subscribe((res) => {
        this.ranking = res;
      });
    }


  }

  getMaxBattleScore(songData: { [key: number]: ISongData }): number {
    const scores = Object.values(songData).map(song => song.battleScoreMax);
    return scores.length > 0 ? Math.max(...scores) : 0;
  }

  handleTabButtonClick(level: number) {
    const { id } = this.music;
    const param = new HttpParams().set('musicId', id).set('level', level);
    this.api.get('api/game/ongeki/musicScoreRanking', param).subscribe(
      res => {
        this.ranking = res;
      }
    );
  }

  isLunatic(song: OngekiMusic) {
    return song.level0 === '0,0' &&
      song.level1 === '0,0' &&
      song.level2 === '0,0' &&
      song.level3 === '0,0';
  }

  getLevelString(song: OngekiMusic, level: number) {
    if (!song) { return '0'; }
    if (level === 0){
      return song.level0;
    }
    else if (level === 1){
      return song.level1;
    }
    else if (level === 2){
      return song.level2;
    }
    else if (level === 3){
      return song.level3;
    }
    else if (level === 10){
      return song.level4;
    }
    else { return '0'; }
  }

  battleScoreRank(score: number) {
    switch (true) {
      case (score >= 1007500):
        return 'SSS+';
      case score >= 1000000 && score <= 1007499:
        return 'SSS';
      case score >= 990000 && score <= 999999:
        return 'SS';
      case score >= 970000 && score <= 989999:
        return 'S';
      case score >= 940000 && score <= 969999:
        return 'AAA';
      case score >= 900000 && score <= 939999:
        return 'AA';
      case score >= 850000 && score <= 899999:
        return 'A';
      case score >= 800000 && score <= 849999:
        return 'BBB';
      case score >= 750000 && score <= 799999:
        return 'BB';
      case score >= 700000 && score <= 749999:
        return 'B';
      case score >= 500000 && score <= 699999:
        return 'C';
      case score >= 0 && score <= 499999:
        return 'D';
    }
  }
}
