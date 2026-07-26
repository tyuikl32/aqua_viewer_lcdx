import {Injectable} from '@angular/core';
import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import {BehaviorSubject, Observable, throwError} from 'rxjs';
import {catchError, filter, switchMap, take} from 'rxjs/operators';
import {environment} from 'src/environments/environment';
import {AccountService} from './account.service';
import {StatusCode} from '../status-code';

@Injectable()
export class TokenInterceptorService implements HttpInterceptor {
  // Refresh calls bypass the interceptor chain entirely (no recursion, no DI cycle)
  private rawHttp: HttpClient;
  private refreshing = false;
  private refreshedToken = new BehaviorSubject<string>(null);

  constructor(
    private accountService: AccountService,
    httpBackend: HttpBackend) {
    this.rawHttp = new HttpClient(httpBackend);
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(this.withToken(request)).pipe(catchError(err => {
      const account = this.accountService.currentAccountValue;
      // Access tokens are short-lived by design: on 401, refresh once and retry.
      // If the refresh fails too, rethrow so ErrorInterceptorService clears the
      // account and reloads the page.
      if (err instanceof HttpErrorResponse && err.status === 401
        && request.url.startsWith(environment.apiServer)
        && account?.refreshToken) {
        return this.refreshAndRetry(request, next, err);
      }
      return throwError(() => err);
    }));
  }

  private withToken(request: HttpRequest<any>): HttpRequest<any> {
    const account = this.accountService.currentAccountValue;
    if (request.url.startsWith(environment.apiServer) && account?.tokenType && account?.accessToken) {
      request = request.clone({
        setHeaders: {
          Authorization: `${account.tokenType} ${account.accessToken}`
        }
      });
    }
    return request;
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
}
