import {Injectable} from '@angular/core';
import {IMPERSONATION_KEY, inIframe} from './account.service';

export const IMPERSONATE_REQUEST = 'rinnet-impersonate-request';
export const IMPERSONATE_GRANT = 'rinnet-impersonate-grant';
export const IMPERSONATE_ADMIN_REQUEST = 'rinnet-impersonate-admin-request';
export const IMPERSONATE_ADMIN_RESPONSE = 'rinnet-impersonate-admin-response';
export const IMPERSONATION_ADMIN_CONTEXT_KEY = 'impersonationAdminContext';

export type ImpersonationAdminAction = 'bind-card-by-ext-id' | 'unbind-card-by-ext-id' |
  'set-default-card' | 'remove-external-code' | 'set-game-ban-state' | 'refresh-admin-context';

export function isTrustedImpersonationAdminEnvelope(event: MessageEvent, frameWindow: Window | null,
  nonce: string, target: string, actions: readonly ImpersonationAdminAction[]): boolean {
  const message = event.data;
  return event.origin === location.origin && event.source === frameWindow && !!nonce &&
    message?.type === IMPERSONATE_ADMIN_REQUEST && message?.nonce === nonce && message?.target === target &&
    typeof message?.requestId === 'string' && message.requestId.length > 0 && actions.includes(message?.action);
}

export function isTrustedImpersonationGrant(event: MessageEvent, parentWindow: Window, nonce: string): boolean {
  return event.origin === window.location.origin && event.source === parentWindow &&
    event.data?.type === IMPERSONATE_GRANT && event.data?.nonce === nonce && !!event.data?.account &&
    event.data?.adminContext?.nonce === nonce && typeof event.data?.adminContext?.target === 'string' &&
    Array.isArray(event.data?.adminContext?.actions);
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

  get adminContext(): any {
    try { return JSON.parse(sessionStorage.getItem(IMPERSONATION_ADMIN_CONTEXT_KEY)); }
    catch { return null; }
  }

  requestAdminAction(action: ImpersonationAdminAction, payload: any = {}): Promise<any> {
    const context = this.adminContext;
    if (!this.active || !context?.nonce || !context?.target || !context?.actions?.includes(action)) {
      return Promise.reject(new Error('Impersonation admin context is not active'));
    }
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const listener = (event: MessageEvent) => {
        if (event.origin !== location.origin || event.source !== window.parent ||
          event.data?.type !== IMPERSONATE_ADMIN_RESPONSE || event.data?.nonce !== context.nonce ||
          event.data?.target !== context.target || event.data?.requestId !== requestId) return;
        window.removeEventListener('message', listener);
        event.data.ok ? resolve(event.data.data) : reject(new Error(event.data.error || 'Admin action failed'));
      };
      window.addEventListener('message', listener);
      window.parent.postMessage({type: IMPERSONATE_ADMIN_REQUEST, nonce: context.nonce,
        target: context.target, requestId, action, payload}, location.origin);
    });
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
    sessionStorage.removeItem(IMPERSONATION_ADMIN_CONTEXT_KEY);

    const onMessage = (event: MessageEvent) => {
      if (!isTrustedImpersonationGrant(event, window.parent, nonce)) {
        return;
      }
      window.removeEventListener('message', onMessage);
      sessionStorage.setItem(IMPERSONATION_KEY, JSON.stringify(event.data.account));
      sessionStorage.setItem(IMPERSONATION_ADMIN_CONTEXT_KEY, JSON.stringify(event.data.adminContext));
      window.location.replace(window.location.origin + '/');
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({type: IMPERSONATE_REQUEST, nonce}, window.location.origin);
  }
}
