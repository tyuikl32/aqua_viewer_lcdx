/* tslint:disable:no-unused-variable */

import {inject, TestBed} from '@angular/core/testing';
import {AuthGuardService} from './auth-guard.service';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';
import {RouterTestingModule} from '@angular/router/testing';

describe('Service: AuthGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [RouterTestingModule],
    providers: [AuthGuardService, provideHttpClient(withXhr(), withInterceptorsFromDi())]
});
  });

  it('should ...', inject([AuthGuardService], (service: AuthGuardService) => {
    expect(service).toBeTruthy();
  }));
});
