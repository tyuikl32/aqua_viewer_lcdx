import {IMPERSONATE_ADMIN_REQUEST, IMPERSONATE_GRANT, isTrustedImpersonationAdminEnvelope,
  isTrustedImpersonationGrant} from './impersonation.service';

describe('impersonation admin envelope', () => {
  const frame = {} as Window;
  const actions: any[] = ['refresh-admin-context'];
  const event = (overrides: any = {}) => ({origin: location.origin, source: frame, data: {
    type: IMPERSONATE_ADMIN_REQUEST, nonce: 'nonce', target: 'target', requestId: 'request',
    action: 'refresh-admin-context', ...overrides.data}, ...overrides}) as MessageEvent;

  it('accepts only the active iframe envelope', () => {
    expect(isTrustedImpersonationAdminEnvelope(event(), frame, 'nonce', 'target', actions)).toBeTrue();
  });

  it('rejects forged origin, source, nonce, target and action', () => {
    expect(isTrustedImpersonationAdminEnvelope(event({origin: 'https://evil.invalid'}), frame, 'nonce', 'target', actions)).toBeFalse();
    expect(isTrustedImpersonationAdminEnvelope(event({source: {} as Window}), frame, 'nonce', 'target', actions)).toBeFalse();
    expect(isTrustedImpersonationAdminEnvelope(event({data: {nonce: 'stale'}}), frame, 'nonce', 'target', actions)).toBeFalse();
    expect(isTrustedImpersonationAdminEnvelope(event({data: {target: 'other'}}), frame, 'nonce', 'target', actions)).toBeFalse();
    expect(isTrustedImpersonationAdminEnvelope(event({data: {action: 'arbitrary-api'}}), frame, 'nonce', 'target', actions)).toBeFalse();
    expect(isTrustedImpersonationAdminEnvelope(event({data: {requestId: ''}}), frame, 'nonce', 'target', actions)).toBeFalse();
  });

  it('accepts grants only from the live parent window', () => {
    const grant = {origin: location.origin, source: frame, data: {type: IMPERSONATE_GRANT, nonce: 'nonce',
      account: {accessToken: 'target-only'}, adminContext: {nonce: 'nonce', target: 'target', actions: []}}} as MessageEvent;
    expect(isTrustedImpersonationGrant(grant, frame, 'nonce')).toBeTrue();
    expect(isTrustedImpersonationGrant({...grant, source: {} as Window} as MessageEvent, frame, 'nonce')).toBeFalse();
    expect(isTrustedImpersonationGrant({...grant, data: {...grant.data, nonce: 'stale'}} as MessageEvent,
      frame, 'nonce')).toBeFalse();
  });
});
