import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, CanLoad, Route, Router, RouterStateSnapshot} from '@angular/router';
import {AccountService} from './account.service';
import {UserService} from '../user.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuardService implements CanLoad, CanActivate {

  constructor(
    private router: Router,
    protected user: UserService) {
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    if (this.isAdmin()) {
      return true;
    }

    this.router.navigate(['/dashboard']);
    return false;
  }

  canLoad(route: Route) {
    if (this.isAdmin()) {
      return true;
    }

    this.router.navigate(['/dashboard']);
    return false;
  }

  isAdmin() {
    return this.user.currentUser?.roles?.some(r => r.id === 5) ?? false;
  }
}
