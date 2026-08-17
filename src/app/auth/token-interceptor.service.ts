import {Injectable} from '@angular/core';
import { HttpBackend, HttpClient, HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import {BehaviorSubject, Observable, Subscription, throwError} from 'rxjs';
import {catchError, filter, switchMap, take} from 'rxjs/operators';
import {environment} from 'src/environments/environment';
import {Account, AccountService} from './account.service';
import {StatusCode} from '../status-code';

@Injectable()
export class TokenInterceptorService implements HttpInterceptor {
  // Refresh calls bypass the interceptor chain entirely (no recursion, no DI cycle)
  private rawHttp: HttpClient;
  private refreshing = false;
  private refreshedToken = new BehaviorSubject<string>(null);

  // Proactive refresh fires this far ahead of the access token's exp, so the
  // user never sees the 401 round-trip that the reactive path would add
  private static readonly REFRESH_LEAD_TIME_MS = 30_000;
  private refreshTimer: any = null;
  private accountSub?: Subscription;

  constructor(
    private accountService: AccountService,
    httpBackend: HttpBackend) {
    this.rawHttp = new HttpClient(httpBackend);
    // Sliding TTL on the backend + proactive refresh here means an active
    // session never ages out and never sees a refresh hiccup; the reactive
    // 401 path below remains as a safety net for throttled/missed timers
    this.accountSub = this.accountService.currentAccount.subscribe(acc => this.rescheduleRefresh(acc));
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(this.withToken(request)).pipe(catchError(err => {
      const account = this.accountService.currentAccountValue;
      // Access tokens are short-lived by design: on 401, refresh once and retry.
      // If the refresh fails too, rethrow so ErrorInterceptorService clears the
      // account and reloads the page.
      if (err instanceof HttpErrorResponse && err.status === 401
        && this.isAuthenticatedApiRequest(request.url)
        && account?.refreshToken) {
        return this.refreshAndRetry(request, next, err);
      }
      return throwError(() => err);
    }));
  }

  private withToken(request: HttpRequest<any>): HttpRequest<any> {
    const account = this.accountService.currentAccountValue;
    if (this.isAuthenticatedApiRequest(request.url) && account?.tokenType && account?.accessToken) {
      request = request.clone({
        setHeaders: {
          Authorization: `${account.tokenType} ${account.accessToken}`
        }
      });
    }
    return request;
  }

  private isAuthenticatedApiRequest(url: string): boolean {
    return url.startsWith(environment.apiServer) || url.startsWith(environment.lcdxApiServer);
  }

  private refreshAndRetry(request: HttpRequest<any>, next: HttpHandler, originalError: any): Observable<HttpEvent<any>> {
    if (!this.refreshing) {
      this.refreshing = true;
      this.refreshedToken.next(null);
      const account = this.accountService.currentAccountValue;
      this.rawHttp.post<any>(environment.apiServer + 'api/auth/refresh', {refreshToken: account.refreshToken})
        .subscribe({
          next: resp => {
            this.refreshing = false;
            // The account may have been cleared (logout) or replaced while the
            // refresh was in flight; writing the captured copy back would log the
            // user straight in again with a token valid for the next 5 minutes
            const current = this.accountService.currentAccountValue;
            if (current?.refreshToken !== account.refreshToken) {
              this.failWaiters(originalError);
              return;
            }
            if (resp?.status?.code === StatusCode.OK && resp.data?.accessToken) {
              this.accountService.currentAccountValue = {...current, accessToken: resp.data.accessToken};
              this.refreshedToken.next(resp.data.accessToken);
            } else {
              this.failWaiters(originalError);
            }
          },
          error: () => {
            this.refreshing = false;
            this.failWaiters(originalError);
          }
        });
    }
    return this.refreshedToken.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(() => next.handle(this.withToken(request)))
    );
  }

  private failWaiters(originalError: any) {
    const failed = this.refreshedToken;
    this.refreshedToken = new BehaviorSubject<string>(null);
    failed.error(originalError);
  }

  /**
   * Plans the next /refresh call to land shortly before the current access
   * token expires. Re-runs on every account change (login, refresh, logout).
   */
  private rescheduleRefresh(account: Account | null) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (!account?.accessToken) return;
    const expMs = this.decodeExpMs(account.accessToken);
    if (!expMs) return;
    const delay = expMs - Date.now() - TokenInterceptorService.REFRESH_LEAD_TIME_MS;
    // If the lead window has already passed, leave it to the reactive 401 path
    // rather than firing a speculative refresh with stale timing
    if (delay <= 0) return;
    this.refreshTimer = setTimeout(() => this.proactiveRefresh(), delay);
  }

  /**
   * Refreshes the access token ahead of its expiry. Stays independent of the
   * single-flight reactive path: a second concurrent /refresh is harmless
   * because the backend's TTL slide is idempotent and access tokens are
   * stateless — both responses are equally valid.
   */
  private proactiveRefresh() {
    const account = this.accountService.currentAccountValue;
    if (!account?.refreshToken) return;
    this.rawHttp.post<any>(environment.apiServer + 'api/auth/refresh', {refreshToken: account.refreshToken})
      .subscribe({
        next: resp => {
          // The account may have been cleared (logout) or replaced (rotation)
          // while the request was in flight; writing the captured copy back
          // would log a stale session straight in again
          const current = this.accountService.currentAccountValue;
          if (current?.refreshToken !== account.refreshToken) return;
          if (resp?.status?.code === StatusCode.OK && resp.data?.accessToken) {
            this.accountService.currentAccountValue = {...current, accessToken: resp.data.accessToken};
          }
        },
        error: () => {
          // Silent: the reactive 401 path will pick this up on the next request
        }
      });
  }

  private decodeExpMs(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }
}
