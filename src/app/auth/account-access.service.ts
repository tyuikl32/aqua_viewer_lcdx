import {Injectable} from '@angular/core';
import {BehaviorSubject, firstValueFrom} from 'rxjs';
import {ApiService} from '../api.service';
import {AccountService} from './account.service';

export interface AccountAccessStatus {
  banned: boolean;
  appeal: string;
}

@Injectable({providedIn: 'root'})
export class AccountAccessService {
  private statusSubject = new BehaviorSubject<AccountAccessStatus | null>(null);
  readonly status$ = this.statusSubject.asObservable();
  private loadPromise: Promise<AccountAccessStatus> = null;

  constructor(private api: ApiService, private accounts: AccountService) {
    window.addEventListener('rinnet-account-access-error', ((event: CustomEvent<string>) => {
      if (event.detail === 'ACCOUNT_BANNED') this.markBanned();
    }) as EventListener);
  }

  get status(): AccountAccessStatus | null { return this.statusSubject.value; }

  async restore(force = false): Promise<AccountAccessStatus | null> {
    if (!this.accounts.currentAccountValue) {
      this.clear();
      return null;
    }
    if (this.status && !force) return this.status;
    if (!this.loadPromise) {
      this.loadPromise = firstValueFrom(this.api.get('api/account/status'))
        .then(resp => {
          this.statusSubject.next(resp.data as AccountAccessStatus);
          return this.status;
        })
        .finally(() => this.loadPromise = null);
    }
    return this.loadPromise;
  }

  markBanned() {
    const previous = this.status;
    this.statusSubject.next({banned: true, appeal: previous?.appeal ?? 'QQ群 295954906'});
  }

  clear() { this.statusSubject.next(null); }
}
