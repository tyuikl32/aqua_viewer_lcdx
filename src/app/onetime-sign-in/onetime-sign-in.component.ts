import { Component } from '@angular/core';
import {AuthenticationService} from '../auth/authentication.service';
import {MessageService} from '../message.service';
import {StatusCode} from '../status-code';
import {TranslateService} from '@ngx-translate/core';
import {ActivatedRoute, Router} from '@angular/router';

@Component({
  selector: 'app-onetime-sign-in',
  templateUrl: './onetime-sign-in.component.html',
  styleUrls: ['./onetime-sign-in.component.css']
})

export class OnetimeSignInComponent {
  constructor(
    private authenticationService: AuthenticationService,
    public messageService: MessageService,
    public route: ActivatedRoute,
    private router: Router,
    private translate: TranslateService,
  ) {
    this.route.queryParams.subscribe((data) => {
      this.load(data.token);
    });
  }

  load(token: string) {
    this.authenticationService.login_lcdx(token)
      .subscribe(
        {
          next: (resp) => {
            if (resp?.status) {
              const statusCode: StatusCode = resp.status.code;
              if (statusCode === StatusCode.OK && resp.data) {
                this.messageService.notice(resp.status.message);
                this.router.navigate(['/dashboard']);
              }
              else if (statusCode === StatusCode.LOGIN_FAILED){
                this.translate.get('SignInPage.LoginFailedMessage').subscribe((res: string) => {
                  this.messageService.notice(res, 'danger');
                });
                this.router.navigate(['/']);
              }
              else{
                this.messageService.notice(resp.status.message);
                this.router.navigate(['/']);
              }
            }
          },
          error: (error) => {
            this.messageService.notice(error);
            this.router.navigate(['/']);
          }
        }
      );
  }
}
