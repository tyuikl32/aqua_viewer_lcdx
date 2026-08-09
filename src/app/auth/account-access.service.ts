import {Injectable} from '@angular/core';
import {BehaviorSubject, firstValueFrom} from 'rxjs';
import {ApiService} from '../api.service';
import {AccountService} from './account.service';
import {StatusCode} from '../status-code';

export interface AccountAccessStatus {
  banned: boolean;
  eulaRequired: boolean;
  currentEulaVersion: number;
  acceptedEulaVersion: number | null;
  appeal: string;
}

export interface EulaDocument {
  id: number;
  version: number;
  title: string;
  content: string;
  publishedAt: string;
  draft?: boolean;
}

@Injectable({providedIn: 'root'})
export class AccountAccessService {
  private statusSubject = new BehaviorSubject<AccountAccessStatus | null>(null);
  readonly status$ = this.statusSubject.asObservable();
  private loadPromise: Promise<AccountAccessStatus> = null;

  constructor(private api: ApiService, private accounts: AccountService) {
    window.addEventListener('rinnet-account-access-error', ((event: CustomEvent<string>) => {
      if (event.detail === 'EULA_REQUIRED') this.requireEula();
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

  currentEula(): Promise<EulaDocument> {
    return firstValueFrom(this.api.get('api/eula/current')).then(resp => resp.data);
  }

  async accept(version: number): Promise<boolean> {
    const resp = await firstValueFrom(this.api.post('api/account/eula/accept', {version}));
    if (resp?.status?.code === StatusCode.OK) await this.restore(true);
    return !this.status?.eulaRequired;
  }

  requireEula() {
    const previous = this.status;
    this.statusSubject.next({banned: false, eulaRequired: true, currentEulaVersion: previous?.currentEulaVersion,
      acceptedEulaVersion: previous?.acceptedEulaVersion ?? null, appeal: previous?.appeal ?? 'QQ群 295954906'});
  }

  markBanned() {
    const previous = this.status;
    this.statusSubject.next({banned: true, eulaRequired: false, currentEulaVersion: previous?.currentEulaVersion,
      acceptedEulaVersion: previous?.acceptedEulaVersion ?? null, appeal: previous?.appeal ?? 'QQ群 295954906'});
  }

  clear() { this.statusSubject.next(null); }
}
