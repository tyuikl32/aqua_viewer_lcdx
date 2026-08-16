import {NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';
import {AnnouncementsComponent} from './announcements/announcements.component';
import {AuthGuardService} from './auth/auth-guard.service';
import {LoginGuardService} from './auth/login-guard.service';
import {BannedComponent} from './banned/banned.component';
import {DashboardComponent} from './dashboard/dashboard.component';
import {EulaComponent} from './eula/eula.component';
import {HomeComponent} from './home/home.component';
import {NetcodeBindComponent} from './netcode-bind/netcode-bind.component';
import {NotFoundComponent} from './not-found/not-found.component';
import {OnetimeSignInComponent} from './onetime-sign-in/onetime-sign-in.component';
import {SignInComponent} from './sign-in/sign-in.component';
import {SignUpComponent} from './sign-up/sign-up.component';

export const routes: Routes = [
  {path: '', component: HomeComponent, data: {title: 'Home', disableSidebar: true}},
  {path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuardService], data: {title: 'Dashboard'}},
  {path: 'announcements', component: AnnouncementsComponent, canActivate: [AuthGuardService], data: {title: 'Announcements'}},
  {
    path: 'mai2',
    loadChildren: () => import('./sega/maimai2/maimai2.module').then(mod => mod.Maimai2Module),
    canMatch: [AuthGuardService],
    data: {title: 'Mai2'}
  },
  {path: 'onetime-sign-in', component: OnetimeSignInComponent, data: {title: 'OneTimeSignIn', disableSidebar: true}},
  {
    path: 'netcode-bind',
    component: NetcodeBindComponent,
    canActivate: [AuthGuardService],
    data: {title: 'NetCodeBind', disableSidebar: true}
  },
  {
    path: 'sign-in',
    component: SignInComponent,
    canActivate: [LoginGuardService],
    data: {title: 'SignIn', disableSidebar: true}
  },
  {
    path: 'sign-up',
    component: SignUpComponent,
    canActivate: [LoginGuardService],
    data: {title: 'SignUp', disableSidebar: true}
  },
  {path: 'eula', component: EulaComponent, data: {title: 'EULA', disableSidebar: true, accessLayout: true}},
  {path: 'banned', component: BannedComponent, data: {title: 'Account Banned', disableSidebar: true, accessLayout: true}},
  {path: 'not-found', component: NotFoundComponent, data: {title: 'NotFound', disableSidebar: true}},
  {path: '**', redirectTo: '/not-found'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {preloadingStrategy: PreloadAllModules, scrollPositionRestoration: 'top'})],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
