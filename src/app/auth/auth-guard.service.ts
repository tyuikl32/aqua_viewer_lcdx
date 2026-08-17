import {AccountService} from 'src/app/auth/account.service';
import {Injectable} from '@angular/core';
import {
  CanLoad,
  CanActivate,
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  Route,
  CanMatch,
  UrlSegment,
  UrlTree
} from '@angular/router';
import {Observable} from 'rxjs';
import {AccountAccessService} from './account-access.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuardService implements CanMatch, CanActivate {

  constructor(
    private router: Router,
    private accountService: AccountService,
    private access: AccountAccessService
  ) {
  }

  canMatch(route: Route, segments: UrlSegment[]): boolean | UrlTree | Observable<boolean | UrlTree> | Promise<boolean | UrlTree> {
    return this.checkAccess();
    }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.checkAccess();
  }

  private async checkAccess(): Promise<boolean | UrlTree> {
    if (!this.accountService.currentAccountValue) return this.router.parseUrl('/');
    const status = await this.access.restore();
    if (status?.banned) return this.router.parseUrl('/banned');
    return true;
  }

}
