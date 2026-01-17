import {mergeMap, of} from 'rxjs';
import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {map} from 'rxjs/operators';
import {environment} from '../../environments/environment';
import {StatusCode} from '../status-code';
import {UserService} from '../user.service';
import {AccountService} from './account.service';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {
  constructor(
    private accountService: AccountService,
    private http: HttpClient,
    private userService: UserService
) {
  }

  login(usernameOrEmail: string, password: string, token: string) {
    const params: any = {usernameOrEmail, password};
    if (token){
      params.oAuth2Token = token;
    }
    return this.http.post<any>(environment.apiServer + 'api/auth/signin', params)
      .pipe(
        map(
          resp => {
            return resp;
          }
        ),
        mergeMap(this.procLoginResp));
  }

  loginAs(username: string) {
    return this.http.post<any>(environment.apiServer + `api/admin/users/loginas/${username}`, {})
      .pipe(
        map(
          resp => {
            return resp;
          }
        ),
        mergeMap(this.procLoginResp));
  }

  login_lcdx_common(usernameOrEmail: string, password: string) {
    const params: any = {usernameOrEmail, password};

    return this.http.post<any>(environment.lcdxApiServer + 'lcdx/login', params)
      .pipe(
        map(
          resp => {
            return resp;
          }
        ),
        mergeMap(this.procLoginResp));
  }

  login_lcdx(token: string) {
    return this.http.get<any>(environment.lcdxApiServer + 'lcdx/onetime-v2/' + token)
      .pipe(
        map(
          resp => {
            return resp;
          }
        ),
        mergeMap(this.procLoginResp));
  }

  loginWithOAuth(oauthCode: string, type: string) {
    return this.http.post<any>(`${environment.apiServer}api/auth/signin/oauth2/${oauthCode}/${type}`, null)
    .pipe(
      map(
        resp => {
          return resp;
        }
      ),
      mergeMap(this.procLoginResp));
  }

  signUp(name: string, username: string, email: string, verifyCode: string, password: string, token: string) {
    const params: any = {name, username, email, verifyCode, password};
    if (token){
      params.oAuth2Token = token;
    }
    return this.http.post<any>(environment.apiServer + 'api/auth/signup', params)
    .pipe(
      map(
        resp => {
          return resp;
        }
      ),
      mergeMap(this.procLoginResp));
  }

  signUp_lcdx(qqNumber: string, code: string, password: string) {
    const params: any = { code, password};
    return this.http.post<any>(environment.lcdxApiServer + 'lcdx/register_confirm/' + qqNumber, params)
      .pipe(
        map(
          resp => {
            return resp;
          }
        ),
        mergeMap(this.procLoginResp));
  }

  procLoginResp = (loginResp) => {
    const loginStatusCode: StatusCode = loginResp?.status?.code;
    if (loginStatusCode !== StatusCode.OK || !loginResp.data) {
      return of(loginResp);
    }
    this.accountService.currentAccountValue = loginResp.data;
    return this.userService.load(true).then(
      resp => {
        return resp;
      }
    );
  }

  resetPassword(emailAddress: string, verifyCode: string, password: string) {
    return this.http.post<any>(environment.apiServer + 'api/auth/resetPassword', {emailAddress, verifyCode, password})
      .pipe(
        map(
          resp => {
            return resp;
          }
        )
      );
  }

  getVerifyCode(email: string) {
    return this.http.post<any>(environment.apiServer + 'api/auth/getVerifyCode', {email})
      .pipe(
        map(
          resp => {
            return resp;
          }
        )
      );
  }

  getVerifyCode_lcdx(email: string) {
    return this.http.get<any>(environment.lcdxApiServer + 'lcdx/register_start/' + email)
      .pipe(
        map(
          resp => {
            return resp;
          }
        )
      );
  }

  checkUsernameAvailability(username: string) {
    return this.http.get<any>(environment.apiServer + 'api/user/checkUsernameAvailability', {params: {username}})
      .pipe(
        map(
          resp => {
            return resp;
          }
        )
      );
  }

  checkEmailAvailability(email: string) {
    return this.http.get<any>(environment.apiServer + 'api/user/checkEmailAvailability', {params: {email}})
      .pipe(
        map(
          resp => {
            return resp;
          }
        )
      );
  }

  getResetPasswordCode(email: string) {
    return this.http.post<any>(environment.apiServer + 'api/auth/getResetPasswordCode', {email})
      .pipe(
        map(
          resp => {
            return resp;
          }
        )
      );
  }

  logout() {
    this.accountService.clear();
    this.userService.clear();
  }

}

