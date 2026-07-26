import {BehaviorSubject} from 'rxjs';
import {Injectable} from '@angular/core';

/** Storage key for the impersonation session that lives inside the admin's iframe. */
export const IMPERSONATION_KEY = 'impersonatedAccount';

export function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent: treat as embedded
    return true;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private currentAccountSubject: BehaviorSubject<Account>;

  // An admin impersonating a user runs the portal in a same-origin iframe, which
  // shares localStorage with the admin's own page. Keeping the impersonated session
  // in sessionStorage under its own key stops the two from overwriting each other.
  private readonly storage: Storage = inIframe() ? sessionStorage : localStorage;
  private readonly storageKey: string = inIframe() ? IMPERSONATION_KEY : 'currentAccount';

  constructor() {
    this.currentAccountSubject = new BehaviorSubject<Account>(JSON.parse(this.storage.getItem(this.storageKey)));
  }

  public get currentAccountValue(): Account {
    return this.currentAccountSubject.value;
  }

  public set currentAccountValue(account: Account) {
    this.storage.setItem(this.storageKey, JSON.stringify(account));
    this.currentAccountSubject.next(account);
  }

  public clear(){
    this.storage.removeItem(this.storageKey);
    this.currentAccountSubject.next(null);
  }
}

export class Account {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
}
