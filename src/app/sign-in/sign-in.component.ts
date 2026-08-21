import {ChangeDetectionStrategy, Component} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {AuthenticationService} from '../auth/authentication.service';
import {MessageService} from '../message.service';
import {StatusCode} from '../status-code';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SignInComponent {
  signInForm: FormGroup;
  totpForm: FormGroup;
  totpToken: string;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authenticationService: AuthenticationService,
    public messageService: MessageService,
    private translate: TranslateService
  ) {
    this.signInForm = this.fb.group({
      qqNumber: ['', [
        Validators.required,
        Validators.pattern(/^\d{5,12}$/)
      ]],
      password: ['', Validators.required]
    });
    this.totpForm = this.fb.group({
      code: ['', [
        Validators.required,
        Validators.pattern(/^(\d{6}|[A-Za-z0-9]{5}-[A-Za-z0-9]{5})$/)
      ]]
    });

    const state = this.router.getCurrentNavigation()?.extras.state;
    if (state?.qqNumber) {
      this.qqNumber.setValue(state.qqNumber);
      history.replaceState({}, document.title);
    }
  }

  get qqNumber() {
    return this.signInForm.get('qqNumber');
  }

  get password() {
    return this.signInForm.get('password');
  }

  get totpCode() {
    return this.totpForm.get('code');
  }

  navigateToSignUp() {
    void this.router.navigate(['/sign-up'], {state: {qqNumber: this.qqNumber.value}});
  }

  onSubmit() {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    this.signInForm.disable();
    const value = this.signInForm.getRawValue();
    this.authenticationService.login_lcdx_common(value.qqNumber, value.password).subscribe({
      next: async resp => {
        const statusCode: StatusCode = resp?.status?.code;
        if (statusCode === StatusCode.OK && resp.data) {
          this.translate.get('SignInPage.LoginSuccessMessage').subscribe(message => {
            this.messageService.notice(message);
          });
          if (this.router.url.startsWith('/sign-in')) {
            await this.router.navigate(['/dashboard']);
          }
        } else if (statusCode === StatusCode.TOTP_REQUIRED && resp.data?.totpToken) {
          this.totpToken = resp.data.totpToken;
        } else if (statusCode === StatusCode.LOGIN_FAILED) {
          this.translate.get('SignInPage.LoginFailedMessage').subscribe(message => {
            this.messageService.notice(message, 'danger');
          });
        } else {
          this.messageService.notice(resp?.status?.message);
        }
        this.signInForm.enable();
      },
      error: error => {
        this.messageService.notice(error);
        this.signInForm.enable();
        console.warn('login fail', error);
      }
    });
  }

  onSubmitTotp() {
    if (this.totpForm.invalid) {
      this.totpForm.markAllAsTouched();
      return;
    }

    this.totpForm.disable();
    this.authenticationService.loginWithTotp(this.totpToken, this.totpForm.value.code).subscribe({
      next: async resp => {
        const statusCode: StatusCode = resp?.status?.code;
        if (statusCode === StatusCode.OK && resp.data) {
          this.translate.get('SignInPage.LoginSuccessMessage').subscribe(message => {
            this.messageService.notice(message);
          });
          if (this.router.url.startsWith('/sign-in')) {
            await this.router.navigate(['/dashboard']);
          }
          return;
        }

        if (statusCode === StatusCode.TOTP_INVALID) {
          this.translate.get('SignInPage.TotpInvalidMessage').subscribe(message => {
            this.messageService.notice(message, 'danger');
          });
        } else if (statusCode === StatusCode.TOTP_TOO_MANY_ATTEMPTS) {
          this.totpToken = null;
          this.translate.get('SignInPage.TotpLockedMessage').subscribe(message => {
            this.messageService.notice(message, 'danger');
          });
        } else {
          this.totpToken = null;
          this.messageService.notice(resp?.status?.message);
        }
        this.totpForm.enable();
        this.totpForm.reset();
      },
      error: error => {
        this.messageService.notice(error);
        this.totpForm.enable();
      }
    });
  }

  cancelTotp() {
    this.totpToken = null;
    this.totpForm.reset();
    this.signInForm.enable();
  }
}
