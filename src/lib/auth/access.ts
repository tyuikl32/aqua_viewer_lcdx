import { api } from '@/lib/api/client';
import { createStore } from '@/lib/store';
import { getAccount } from '@/lib/auth/account';

/** 等价旧版 account-access.service.ts（LCDX 已删除 EULA，见上游 e1f80ea "Remove EULA"） */

export interface AccountAccessStatus {
  banned: boolean;
  appeal: string;
}

export const accessStatusStore = createStore<AccountAccessStatus | null>(null);
let loadPromise: Promise<AccountAccessStatus | null> | null = null;

export function getAccessStatus(): AccountAccessStatus | null {
  return accessStatusStore.get();
}

window.addEventListener('rinnet-account-access-error', ((event: CustomEvent<string>) => {
  if (event.detail === 'ACCOUNT_BANNED') markBanned();
}) as EventListener);

export async function restoreAccess(force = false): Promise<AccountAccessStatus | null> {
  if (!getAccount()) {
    clearAccess();
    return null;
  }
  if (getAccessStatus() && !force) return getAccessStatus();
  if (!loadPromise) {
    loadPromise = api
      .get('api/account/status')
      .then((resp) => {
        accessStatusStore.set(resp.data as AccountAccessStatus);
        return getAccessStatus();
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

export function markBanned() {
  const previous = getAccessStatus();
  accessStatusStore.set({
    banned: true,
    appeal: previous?.appeal ?? 'QQ群 295954906',
  });
}

export function clearAccess() {
  accessStatusStore.set(null);
}
