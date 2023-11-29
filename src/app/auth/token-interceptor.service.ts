import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import {Observable} from 'rxjs';
import {AuthenticationService} from './authentication.service';
@Injectable()
export class TokenInterceptorService implements HttpInterceptor {
  constructor(public auth: AuthenticationService) {}
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.auth.currentUserValue && this.auth.currentUserValue.tokenType && this.auth.currentUserValue.accessToken){
      request = request.clone({
        setHeaders: {
          Authorization: `${this.auth.currentUserValue.tokenType} ${this.auth.currentUserValue.accessToken}`
        }
      });
    }
    return next.handle(request);
  }
}