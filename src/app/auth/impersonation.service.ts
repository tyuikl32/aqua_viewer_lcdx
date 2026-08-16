import {Injectable} from '@angular/core';
import {IMPERSONATION_KEY, inIframe} from './account.service';

export const IMPERSONATE_REQUEST = 'rinnet-impersonate-request';
export const IMPERSONATE_GRANT = 'rinnet-impersonate-grant';

export function isTrustedImpersonationGrant(event: MessageEvent, parentWindow: Window, nonce: string): boolean {
  return event.origin === window.location.origin && event.source === parentWindow &&
    event.data?.type === IMPERSONATE_GRANT && event.data?.nonce === nonce && !!event.data?.account;
}

/**
 * Admin impersonation ("夺舍") runs the portal inside an iframe on the admin page.
 * Tokens are handed over with postMessage rather than through storage, because the
 * two frames are same-origin and would otherwise share it.
 */
@Injectable({
  providedIn: 'root'
})
export class ImpersonationService {

  get active(): boolean {
    return inIframe() && !!sessionStorage.getItem(IMPERSONATION_KEY);
  }

  /**
   * Runs on boot inside the iframe. A nonce in the URL marks a freshly opened
   * session: clear whatever a previous target left behind, ask the admin page for
   * this target's tokens, then reload without the nonce so the app starts normally.
   * Without a nonce the stored session is already in use and nothing happens, which
   * is also what keeps the reload from looping.
   */
  bootstrap() {
    if (!inIframe()) {
      return;
    }
    const nonce = new URLSearchParams(window.location.search).get('imp');
    if (!nonce) {
      return;
    }
    sessionStorage.removeItem(IMPERSONATION_KEY);

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedImpersonationGrant(event, window.parent, nonce)) {
        return;
      }
      window.removeEventListener('message', onMessage);
      sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(event.data.account));
      window.location.replace(window.location.origin + '/');
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({type: IMPERSONATE_REQUEST, nonce}, window.location.origin);
  }
}
