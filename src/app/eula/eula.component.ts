import {Component, OnInit, signal} from '@angular/core';
import {Router} from '@angular/router';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
import {AccountAccessService, EulaDocument} from '../auth/account-access.service';
import {AuthenticationService} from '../auth/authentication.service';
import {UserService} from '../user.service';

@Component({selector: 'app-eula', templateUrl: './eula.component.html', styleUrls: ['./eula.component.css'], standalone: false})
export class EulaComponent implements OnInit {
  readonly eula = signal<EulaDocument | null>(null);
  readonly html = signal('');
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly accepting = signal(false);

  constructor(private access: AccountAccessService, private auth: AuthenticationService,
              private users: UserService, private router: Router) {}

  async ngOnInit() {
    try {
      const status = await this.access.restore();
      if (status?.banned) { await this.router.navigate(['/banned']); return; }
      if (!status?.eulaRequired) { await this.router.navigate(['/dashboard']); return; }
      await this.loadEula();
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async accept() {
    const eula = this.eula();
    if (!eula) return;
    this.accepting.set(true);
    try {
      if (await this.access.accept(eula.version)) {
        await this.users.load(true);
        await this.router.navigate(['/dashboard']);
      } else {
        await this.loadEula();
      }
    } finally { this.accepting.set(false); }
  }

  async retry() {
    this.loading.set(true);
    try {
      await this.loadEula();
    } finally {
      this.loading.set(false);
    }
  }

  private async loadEula() {
    this.loadError.set(false);
    try {
      const eula = await this.access.currentEula();
      this.eula.set(eula);
      this.html.set(DOMPurify.sanitize(marked.parse(eula.content) as string));
    } catch {
      this.eula.set(null);
      this.html.set('');
      this.loadError.set(true);
    }
  }

  logout() { this.auth.logout().subscribe(() => location.assign('')); }
}
