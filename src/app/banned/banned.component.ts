import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {AccountAccessService} from '../auth/account-access.service';
import {AuthenticationService} from '../auth/authentication.service';

@Component({selector: 'app-banned', templateUrl: './banned.component.html', styleUrls: ['./banned.component.css'], standalone: false})
export class BannedComponent implements OnInit {
  readonly appealGroup = '295954906';
  copied = false;
  constructor(private access: AccountAccessService, private auth: AuthenticationService, private router: Router) {}
  async ngOnInit() {
    const status = await this.access.restore();
    if (!status?.banned) await this.router.navigate([status?.eulaRequired ? '/eula' : '/dashboard']);
  }
  async copy() { await navigator.clipboard.writeText(this.appealGroup); this.copied = true; }
  logout() { this.auth.logout().subscribe(() => location.assign('')); }
}
