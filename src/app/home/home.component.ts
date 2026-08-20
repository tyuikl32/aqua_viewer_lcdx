import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {AccountService} from '../auth/account.service';
import {ApiService} from '../api.service';
import {isOk} from '../model/ApiResponse';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class HomeComponent implements OnInit, OnDestroy {
  globalPlayers: number | null = null;
  globalPlayersWindow = 15;
  private refreshTimer?: ReturnType<typeof setInterval>;

  constructor(
    protected accountService: AccountService,
    private router: Router,
    private api: ApiService
  ) {
  }

  ngOnInit(): void {
    if (this.accountService.currentAccountValue) {
      void this.router.navigate(['/dashboard']);
      return;
    }
    this.refreshGlobalPlayers();
    this.refreshTimer = setInterval(() => this.refreshGlobalPlayers(), 30_000);
  }

  private refreshGlobalPlayers(): void {
    this.api.getLcdx('lcdx/cabinet/global-players').subscribe(resp => {
      if (isOk(resp) && resp.data) {
        this.globalPlayers = resp.data.players;
        this.globalPlayersWindow = resp.data.windowMinutes;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }
}
