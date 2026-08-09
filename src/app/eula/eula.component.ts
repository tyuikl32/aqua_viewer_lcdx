import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {AccountAccessService, EulaDocument} from '../auth/account-access.service';
import {AuthenticationService} from '../auth/authentication.service';
import {UserService} from '../user.service';

@Component({selector: 'app-eula', templateUrl: './eula.component.html', styleUrls: ['./eula.component.css'], standalone: false})
export class EulaComponent implements OnInit {
  eula: EulaDocument;
  html = '';
  accepting = false;

  constructor(private access: AccountAccessService, private auth: AuthenticationService,
              private users: UserService, private router: Router) {}

  async ngOnInit() {
    const status = await this.access.restore();
    if (status?.banned) { await this.router.navigate(['/banned']); return; }
    if (!status?.eulaRequired) { await this.router.navigate(['/dashboard']); return; }
    this.eula = await this.access.currentEula();
    this.html = DOMPurify.sanitize(marked.parse(this.eula.content) as string);
  }

  async accept() {
    this.accepting = true;
    try {
      if (await this.access.accept(this.eula.version)) {
        await this.users.load(true);
        await this.router.navigate(['/dashboard']);
      } else {
        this.eula = await this.access.currentEula();
        this.html = DOMPurify.sanitize(marked.parse(this.eula.content) as string);
      }
    } finally { this.accepting = false; }
  }

  logout() { this.auth.logout().subscribe(() => location.assign('')); }
}
