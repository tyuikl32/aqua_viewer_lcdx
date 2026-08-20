import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {AccountService} from '../auth/account.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class HomeComponent implements OnInit {
  constructor(
    protected accountService: AccountService,
    private router: Router
  ) {
  }

  ngOnInit(): void {
    if (this.accountService.currentAccountValue) {
      void this.router.navigate(['/dashboard']);
    }
  }
}
