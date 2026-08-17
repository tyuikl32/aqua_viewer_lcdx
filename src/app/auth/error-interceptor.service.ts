import {Injectable} from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import {Observable, throwError} from 'rxjs';
import {catchError} from 'rxjs/operators';
import {AccountService} from './account.service';
import {Router} from '@angular/router';
import {StatusCode} from '../status-code';

@Injectable({
  providedIn: 'root'
})
export class ErrorInterceptorService implements HttpInterceptor {

  constructor(
    private accountService: AccountService,
    private router: Router) {
  }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(catchError(err => {
      const statusCode = err?.error?.status?.code;
      if (statusCode === StatusCode.ACCOUNT_BANNED) {
        window.dispatchEvent(new CustomEvent('rinnet-account-access-error', {detail: 'ACCOUNT_BANNED'}));
        this.router.navigate(['/banned']);
      }
      const error = err?.error?.status?.message ?? err?.error?.message ?? `${err.status} ${err.statusText}`;
      if (err.status === 401 && this.accountService.currentAccountValue)
      {
        this.accountService.clear();
        location.reload();
      }
      return throwError(error);
    }));
  }
}
