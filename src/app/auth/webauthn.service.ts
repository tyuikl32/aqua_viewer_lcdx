import {Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {ApiService} from '../api.service';
import {StatusCode} from '../status-code';
import {AuthenticationService} from './authentication.service';

@Injectable({
  providedIn: 'root'
})
export class WebAuthnService {

  constructor(
    private api: ApiService,
    private authenticationService: AuthenticationService
  ) {
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
  }

  // Usernameless passkey login: the server does not know who is signing in until the
  // assertion is verified, so the single-use challenge is tracked by the requestId
  // issued in startAuth and echoed back in finishAuth.
  async login() {
    const startResp = await firstValueFrom(this.api.get('api/auth/webauthn/startAuth'));
    if (startResp?.status?.code !== StatusCode.OK || !startResp.data) {
      return startResp;
    }
    const requestId = startResp.data.requestId;
    const options = JSON.parse(startResp.data.credentialGetJson);
    const publicKey = options.publicKey;
    publicKey.challenge = this.base64UrlToUint8Array(publicKey.challenge);
    // Absent in the usernameless flow; converted only for safety
    if (publicKey.allowCredentials) {
      publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => ({
        ...c,
        id: this.base64UrlToUint8Array(c.id)
      }));
    }

    const credential = await navigator.credentials.get({publicKey}) as PublicKeyCredential;
    const assertion = credential.response as AuthenticatorAssertionResponse;
    const credentialGetJson = JSON.stringify({
      id: credential.id,
      rawId: this.bufferToBase64Url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: (credential as any).authenticatorAttachment ?? undefined,
      response: {
        authenticatorData: this.bufferToBase64Url(assertion.authenticatorData),
        clientDataJSON: this.bufferToBase64Url(assertion.clientDataJSON),
        signature: this.bufferToBase64Url(assertion.signature),
        userHandle: this.bufferToBase64Url(assertion.userHandle)
      },
      clientExtensionResults: credential.getClientExtensionResults()
    });

    const finishResp = await firstValueFrom(
      this.api.post('api/auth/webauthn/finishAuth', {requestId, credentialGetJson}));
    // Reuse the shared post-login handling so account/user state is set like a password login
    const processed = this.authenticationService.procLoginResp(finishResp);
    return processed instanceof Promise ? processed : firstValueFrom(processed);
  }

  async register(nick: string) {
    const startResp = await firstValueFrom(this.api.get('api/user/webauthn/startRegister'));
    if (startResp?.status?.code !== StatusCode.OK || !startResp.data) {
      return startResp;
    }
    const options = JSON.parse(startResp.data);
    options.challenge = this.base64UrlToUint8Array(options.challenge);
    options.user.id = this.base64UrlToUint8Array(options.user.id);
    if (options.excludeCredentials) {
      options.excludeCredentials = options.excludeCredentials.map((c: any) => ({
        ...c,
        id: this.base64UrlToUint8Array(c.id)
      }));
    }

    const credential = await navigator.credentials.create({publicKey: options}) as PublicKeyCredential;
    const attestation = credential.response as AuthenticatorAttestationResponse;
    const credentialCreateJson = JSON.stringify({
      id: credential.id,
      rawId: this.bufferToBase64Url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: (credential as any).authenticatorAttachment ?? undefined,
      response: {
        clientDataJSON: this.bufferToBase64Url(attestation.clientDataJSON),
        attestationObject: this.bufferToBase64Url(attestation.attestationObject)
      },
      clientExtensionResults: credential.getClientExtensionResults()
    });

    return firstValueFrom(this.api.post('api/user/webauthn/finishRegister', {nick, credentialCreateJson}));
  }

  list() {
    return this.api.get('api/user/webauthn');
  }

  remove(id: number) {
    return this.api.delete(`api/user/webauthn/${id}`);
  }

  // The user dismissed or timed out the browser passkey prompt
  isAborted(e: any): boolean {
    return e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError');
  }

  private base64UrlToUint8Array(input: string): Uint8Array {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  }

  private bufferToBase64Url(buffer: ArrayBuffer | null): string | null {
    if (buffer === null) {
      return null;
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
