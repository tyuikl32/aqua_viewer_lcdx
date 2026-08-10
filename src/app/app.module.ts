import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MessageModule } from './message/message.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import { V2Module } from './sega/chunithm/v2/v2.module';
import { DatabaseModule } from './database/database.module';
import { NgxPaginationModule } from 'ngx-pagination';
import { OngekiModule } from './sega/ongeki/ongeki.module';
import { Maimai2Module } from './sega/maimai2/maimai2.module';
import { ErrorInterceptorService } from './auth/error-interceptor.service';
import { LoadingInterceptorService } from './auth/loading-interceptor.service';
import { ImporterModule } from './importer/importer.module';
import { ServiceWorkerModule } from '@angular/service-worker';
import { environment } from '../environments/environment';
import {
  Maimai2UploadUserPortraitDialog
} from './sega/maimai2/maimai2-setting/maimai2-upload-user-portrait/maimai2-upload-user-portrait.dialog';

import Aegis from 'aegis-web-sdk';
import { NgbModule, NgbModal, NgbOffcanvas } from '@ng-bootstrap/ng-bootstrap';
import { TokenInterceptorService } from './auth/token-interceptor.service';
import { NgIconsModule } from '@ng-icons/core';
import { HomeComponent } from './home/home.component';
import { ToastsContainer } from './toasts-container.component';
import { CardsComponent } from './cards/cards.component';
import {
  bootstrapChevronUp,
  bootstrapChevronDown,
  bootstrapPerson,
  bootstrapList,
  bootstrapEye,
  bootstrapEyeSlash,
  bootstrapTrash,
  bootstrapPencilSquare,
  bootstrapDatabase,
  bootstrapSun,
  bootstrapStars,
  bootstrapTranslate,
  bootstrapCircleHalf,
  bootstrapExclamationTriangleFill,
  bootstrapClipboard,
  bootstrapPlusSquareDotted,
  bootstrapInfoCircleFill,
  bootstrapGithub,
  bootstrapArrowUpCircleFill,
  bootstrapArrowDownCircleFill,
  bootstrapDashLg,
  bootstrapArrowRepeat,
} from '@ng-icons/bootstrap-icons';
import { TranslatePipe, TranslateDirective, TranslateService, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { APP_INITIALIZER } from '@angular/core';
import { NotFoundComponent } from './not-found/not-found.component';
import { ContributorsComponent } from './contributors/contributors.component';
import { LanguageService } from './language.service';
import { lastValueFrom } from 'rxjs';
import { KeychipComponent } from './keychip/keychip.component';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { OauthCallbackComponent } from './oauth-callback/oauth-callback.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { SignUpComponent } from './sign-up/sign-up.component';
import { PasswordResetComponent } from './password-reset/password-reset.component';
import { ProfileComponent } from './profile/profile.component';
import { AnnouncementsComponent } from './announcements/announcements.component';
import { EditComponent } from './announcements/edit/edit.component';
import { AdminComponent } from './admin/admin.component';
import { EulaComponent } from './eula/eula.component';
import { BannedComponent } from './banned/banned.component';

// Blur the focused element before any ng-bootstrap modal or offcanvas opens,
// so ng-bootstrap's aria-hidden on the background doesn't trap focus.
// Centralised here instead of patching 30+ individual call sites.
function _patchDialogFocus(ctor: typeof NgbModal | typeof NgbOffcanvas): void {
  const original = ctor.prototype.open;
  ctor.prototype.open = function(this: unknown, ...args: unknown[]) {
    (document.activeElement as HTMLElement | null)?.blur();
    return (original as (...a: unknown[]) => unknown).apply(this, args);
  };
}
_patchDialogFocus(NgbModal);
_patchDialogFocus(NgbOffcanvas);

// Redirect deprecated 'unload' event to 'pagehide' (W3C replacement) so SDKs
// like Aegis that still register unload listeners don't trip the browser's
// Permissions Policy violation. Safe to keep permanently — pagehide fires in
// all the same scenarios as unload.
{
  const _addEventListener = window.addEventListener.bind(window);
  window.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) =>
    _addEventListener(type === 'unload' ? 'pagehide' : type, listener, options)) as typeof window.addEventListener;
}

const aegis = new Aegis({
  id: 'j4KOYFL0VyajP4KjdG', // 上报 id
  uin: 'xxx', // 用户唯一 ID（可选）
  reportApiSpeed: true, // 接口测速
  reportAssetSpeed: true, // 静态资源测速
  spa: true // spa 应用页面跳转的时候开启 pv 计算
});

export function initializeApp(
  translateService: TranslateService,
  languageService: LanguageService) {
  return async () => {
    const userLang = languageService.getCurrentLang();
    await lastValueFrom(translateService.use(userLang));
  };
}

@NgModule({ declarations: [
        AppComponent,
        Maimai2UploadUserPortraitDialog,
        SignUpComponent,
        HomeComponent,
        PasswordResetComponent,
        CardsComponent,
        NotFoundComponent,
        ContributorsComponent,
        KeychipComponent,
        OauthCallbackComponent,
        SignInComponent,
        ProfileComponent,
        AnnouncementsComponent,
        EditComponent,
        AdminComponent,
        EulaComponent,
        BannedComponent,
    ],
    bootstrap: [AppComponent], imports: [BrowserModule,
        BrowserAnimationsModule,
        NgxPaginationModule,
        DatabaseModule,
        MessageModule,
        AppRoutingModule,
        DashboardModule,
        ImporterModule,
        V2Module,
        OngekiModule,
        Maimai2Module,
        ReactiveFormsModule,
        ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
        NgbModule,
        FormsModule,
        ToastsContainer,
        NgIconsModule.withIcons({
            bootstrapChevronUp,
            bootstrapChevronDown,
            bootstrapPerson,
            bootstrapList,
            bootstrapEye,
            bootstrapEyeSlash,
            bootstrapTrash,
            bootstrapPencilSquare,
            bootstrapDatabase,
            bootstrapSun,
            bootstrapStars,
            bootstrapTranslate,
            bootstrapCircleHalf,
            bootstrapExclamationTriangleFill,
            bootstrapClipboard,
            bootstrapPlusSquareDotted,
            bootstrapInfoCircleFill,
            bootstrapGithub,
            bootstrapArrowUpCircleFill,
            bootstrapArrowDownCircleFill,
            bootstrapDashLg,
            bootstrapArrowRepeat
        }),
        TranslatePipe,
        TranslateDirective,
        ClipboardModule,
        NgbModule], providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptorService, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptorService, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptorService, multi: true },
        { provide: APP_INITIALIZER, useFactory: initializeApp, deps: [TranslateService, LanguageService], multi: true },
        provideTranslateService(),
        provideTranslateHttpLoader(),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
    ] })
export class AppModule {
}
