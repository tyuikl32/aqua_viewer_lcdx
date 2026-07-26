/* tslint:disable:no-unused-variable */

import {inject, TestBed} from '@angular/core/testing';
import {AuthenticationService} from './authentication.service';
import { provideHttpClient, withInterceptorsFromDi, withXhr } from '@angular/common/http';

describe('Service: Authentication', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [AuthenticationService, provideHttpClient(withXhr(), withInterceptorsFromDi())]
});
  });

  it('should ...', inject([AuthenticationService], (service: AuthenticationService) => {
    expect(service).toBeTruthy();
  }));
});
