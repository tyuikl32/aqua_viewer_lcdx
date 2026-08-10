import {IMPERSONATE_GRANT, isTrustedImpersonationGrant} from './impersonation.service';

describe('impersonation grant', () => {
  const frame = {} as Window;

  it('accepts grants only from the live parent window', () => {
    const grant = {origin: location.origin, source: frame, data: {type: IMPERSONATE_GRANT, nonce: 'nonce',
      account: {accessToken: 'target-only'}}} as MessageEvent;
    expect(isTrustedImpersonationGrant(grant, frame, 'nonce')).toBeTrue();
    expect(isTrustedImpersonationGrant({...grant, source: {} as Window} as MessageEvent, frame, 'nonce')).toBeFalse();
    expect(isTrustedImpersonationGrant({...grant, origin: 'https://evil.invalid'} as MessageEvent,
      frame, 'nonce')).toBeFalse();
    expect(isTrustedImpersonationGrant({...grant, data: {...grant.data, nonce: 'stale'}} as MessageEvent,
      frame, 'nonce')).toBeFalse();
  });
});
