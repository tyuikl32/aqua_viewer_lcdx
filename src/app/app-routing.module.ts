import {NgModule} from '@angular/core';
import {PreloadAllModules, RouterModule, Routes} from '@angular/router';
import {DashboardComponent} from './dashboard/dashboard.component';
import {AuthGuardService} from './auth/auth-guard.service';
import {ImporterComponent} from './importer/importer/importer.component';
import {HomeComponent} from './home/home.component';
import {CardsComponent} from './cards/cards.component';
import {KeychipComponent} from './keychip/keychip.component';
import {NotFoundComponent} from './not-found/not-found.component';
import {ContributorsComponent} from './contributors/contributors.component';
import {OauthCallbackComponent} from './oauth-callback/oauth-callback.component';
import {SignInComponent} from './sign-in/sign-in.component';
import {SignUpComponent} from './sign-up/sign-up.component';
import {LoginGuardService} from './auth/login-guard.service';
import {PasswordResetComponent} from './password-reset/password-reset.component';
import {ProfileComponent} from './profile/profile.component';
import {AnnouncementsComponent} from './announcements/announcements.component';
import {EditComponent} from "./announcements/edit/edit.component";
import {OnetimeSignInComponent} from "./onetime-sign-in/onetime-sign-in.component";

const routes: Routes = [
  {path: '', component: HomeComponent, data: {title: 'Home', disableSidebar: true }},
  {path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuardService], data: {title: 'Dashboard'}},
  {path: 'announcements', component: AnnouncementsComponent, canActivate: [AuthGuardService], data: {title: 'Announcements'}},
  {path: 'mai2', loadChildren: () => import('./sega/maimai2/maimai2.module').then(mod => mod.Maimai2Module), canMatch: [AuthGuardService], data: {title: 'Mai2'}},
  {path: 'not-found', component: NotFoundComponent, data: {title: 'NotFound', disableSidebar: true }},
  {path: 'onetime-sign-in', component: OnetimeSignInComponent, data: {title: 'OneTimeSignIn', disableSidebar: true }},
  {path: 'sign-in', component: SignInComponent, data: {title: 'SignIn', disableSidebar: true }},
  {path: '**', redirectTo: '/not-found'}
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {preloadingStrategy: PreloadAllModules, scrollPositionRestoration: 'top'})],
  exports: [RouterModule]
})

export class AppRoutingModule {
}
