import {ChangeDetectionStrategy, Component, OnDestroy} from '@angular/core';
import {FormBuilder, FormGroup, ValidatorFn, Validators} from '@angular/forms';
import {Router} from '@angular/router';
import {interval, Subscription} from 'rxjs';
import {first, take} from 'rxjs/operators';
import {AuthenticationService} from '../auth/authentication.service';
import {MessageService} from '../message.service';
import {StatusCode} from '../status-code';
import {TranslateService} from '@ngx-translate/core';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SignUpComponent implements OnDestroy {
  signUpForm: FormGroup;
  isButtonDisabled = false;
  remainingTime = 0;
  private timerSubscription: Subscription;

  constructor(
    private fb: FormBuilder,
    private authenticationService: AuthenticationService,
    private messageService: MessageService,
    public router: Router,
    private translate: TranslateService
  ) {
    this.signUpForm = this.fb.group({
      qqNumber: ['', [
        Validators.required,
        Validators.pattern(/^\d{5,12}$/)
      ]],
      verifyCode: ['', [
        Validators.required,
        Validators.pattern(/^\d{4}$/)
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(100)
      ]],
      confirmPassword: ['']
    }, {validators: this.checkPasswords});

    const state = this.router.getCurrentNavigation()?.extras.state;
    if (state?.qqNumber) {
      this.qqNumber.setValue(state.qqNumber);
      history.replaceState({}, document.title);
    }
  }

  ngOnDestroy(): void {
    this.timerSubscription?.unsubscribe();
  }

  get qqNumber() {
    return this.signUpForm.get('qqNumber');
  }

  get verifyCode() {
    return this.signUpForm.get('verifyCode');
  }

  get password() {
    return this.signUpForm.get('password');
  }

  get confirmPassword() {
    return this.signUpForm.get('confirmPassword');
  }

  navigateToSignIn() {
    void this.router.navigate(['/sign-in'], {state: {qqNumber: this.qqNumber.value}});
  }

  checkPasswords: ValidatorFn = (form: FormGroup) => {
    return form.get('password').value === form.get('confirmPassword').value ? null : {notSame: true};
  };

  getVerifyCode() {
    if (this.qqNumber.invalid) {
      this.qqNumber.markAsTouched();
      return;
    }

    this.authenticationService.getVerifyCode_lcdx(this.qqNumber.value).pipe(first()).subscribe({
      next: resp => {
        const statusCode: StatusCode = resp?.status?.code;
        if (statusCode === StatusCode.OK) {
          this.translate.get('SignUpPage.Messages.SendCodeSuccess').subscribe(message => {
            this.messageService.notice(message, 'success');
          });
          this.disableButtonForInterval(60);
        } else if (statusCode === StatusCode.VERIFY_CODE_SEND_TOO_FAST) {
          this.translate.get('SignUpPage.Messages.SendCodeTooFast').subscribe(message => {
            this.messageService.notice(message, 'warning');
          });
        } else {
          this.messageService.notice(resp?.status?.message);
        }
      },
      error: error => {
        this.messageService.notice(error);
        console.warn('Send verify code fail.', error);
      }
    });
  }

  private disableButtonForInterval(seconds: number) {
    this.isButtonDisabled = true;
    this.remainingTime = seconds;
    this.timerSubscription?.unsubscribe();
    this.timerSubscription = interval(1000).pipe(take(seconds)).subscribe({
      next: () => this.remainingTime--,
      error: error => console.error(error),
      complete: () => this.isButtonDisabled = false
    });
  }

  onSubmit() {
    if (this.signUpForm.invalid) {
      this.signUpForm.markAllAsTouched();
      return;
    }

    this.signUpForm.disable();
    const value = this.signUpForm.getRawValue();
    this.authenticationService.signUp_lcdx(value.qqNumber, value.verifyCode, value.password).pipe(first()).subscribe({
      next: async resp => {
        const statusCode: StatusCode = resp?.status?.code;
        if (statusCode === StatusCode.OK && resp.data) {
          this.messageService.notice(resp.status.message);
          if (this.router.url.startsWith('/sign-up')) {
            await this.router.navigate(['/dashboard']);
          }
          return;
        }

        if (statusCode === StatusCode.VERIFY_CODE_NOT_CORRECT) {
          this.translate.get('SignUpPage.Messages.CodeIncorrect').subscribe(message => {
            this.messageService.notice(message, 'danger');
          });
        } else {
          this.messageService.notice(resp?.status?.message);
        }
        this.signUpForm.enable();
      },
      error: error => {
        this.messageService.notice(error);
        this.signUpForm.enable();
        console.warn('Sign up failed.', error);
      }
    });
  }
}
