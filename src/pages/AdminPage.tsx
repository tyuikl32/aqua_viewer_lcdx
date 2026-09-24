import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Pagination as ThemedPagination } from '@/components/shared/Pagination';
import { confirm } from '@/components/shell/ConfirmDialog';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { StatusCode, type Card, type User } from '@/lib/models';
import { getAccount, IMPERSONATED_USER_KEY, IMPERSONATION_KEY, type Account } from '@/lib/auth/account';
import { IMPERSONATE_GRANT, IMPERSONATE_REQUEST } from '@/lib/auth/impersonation';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';
import './AdminPage.css';

const PAGE_SIZE = 12;

type AdminTab = 'users' | 'keychips';
type GameKey = 'CHUSAN' | 'MAIMAI2' | 'ONGEKI';

interface ApiEnvelope<T> {
  data?: T;
  status?: { code?: number; message?: string };
}

interface PageData<T> {
  content?: T[];
  totalElements?: number;
}

interface AdminGameData {
  banState?: number;
  banStatus?: number;
  playerRating?: number;
  userName?: string;
}

interface AdminGameProfile {
  card: Card;
  chusan?: AdminGameData | null;
  ongeki?: AdminGameData | null;
  maimai2?: AdminGameData | null;
}

export interface AdvancedUser {
  user: User;
  gameProfiles: AdminGameProfile[];
}

interface SupportCard {
  extId: number;
  defaultCard?: boolean;
  externalLuids?: string[];
}

interface SupportProfile {
  cards?: SupportCard[];
  joinedAt?: string;
  oauthIdentities?: Array<{ email: string; id: number; provider: string }>;
  passkeys?: Array<{ id: number; nick: string }>;
  totpEnabled?: boolean;
  username?: string;
}

interface SupportResponse {
  account: SupportProfile;
  oauthIdentities?: SupportProfile['oauthIdentities'];
  passkeys?: SupportProfile['passkeys'];
  totpEnabled?: boolean;
}

interface AdminKeychip {
  id: number;
  keychipId: string;
  placeName?: string;
  user?: { name?: string } | null;
  whiteListed?: boolean;
}

interface ImpersonationState {
  account: Account;
  nonce: string;
  url: string;
  username: string;
}

function isAccount(value: unknown): value is Account {
  if (!value || typeof value !== 'object') return false;
  const account = value as Partial<Account>;
  return typeof account.accessToken === 'string'
    && account.accessToken.length > 0
    && typeof account.refreshToken === 'string'
    && account.refreshToken.length > 0
    && typeof account.tokenType === 'string'
    && account.tokenType.length > 0;
}

/** Revokes a captured target session without running the admin API interceptor. */
async function revokeRefreshToken(refreshToken: string, keepalive = false): Promise<void> {
  const owner = getAccount();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (owner?.tokenType && owner.accessToken) {
    headers.Authorization = `${owner.tokenType} ${owner.accessToken}`;
  }
  await fetch('/api/auth/signout', {
    method: 'POST',
    headers,
    body: JSON.stringify({ refreshToken }),
    keepalive,
  });
}

function isOk(response: ApiEnvelope<unknown>): boolean {
  return response?.status?.code === StatusCode.OK;
}

function isBanned(item: AdvancedUser): boolean {
  return !(item.user.roles ?? []).some((role) => role.name === 'ROLE_USER');
}

function isAdminTarget(item: AdvancedUser): boolean {
  return (item.user.roles ?? []).some((role) => role.name === 'ROLE_ADMIN');
}

function formatJoinedAt(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

function formatRating(value?: number): string {
  return ((value ?? 0) / 100).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function highlightJson(value: unknown): string {
  const json = (JSON.stringify(value, null, 2) ?? 'null')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return json.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (match.startsWith('"')) {
        cls = match.trimEnd().endsWith(':') ? 'json-key' : 'json-string';
      } else if (match === 'true' || match === 'false') {
        cls = 'json-boolean';
      } else if (match === 'null') {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function Pagination({
  currentPage,
  onChange,
  totalElements,
}: {
  currentPage: number;
  onChange: (page: number) => void;
  totalElements: number;
}) {
  const { family } = useTheme();
  const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
  const pages = useMemo(() => {
    const visible = Math.min(7, totalPages);
    const half = Math.floor(visible / 2);
    let start = Math.max(1, currentPage - half);
    start = Math.min(start, Math.max(1, totalPages - visible + 1));
    return Array.from({ length: visible }, (_, index) => start + index);
  }, [currentPage, totalPages]);

  if (family === 'animal-island') {
    return (
      <div className="admin-pagination-host user-select-none">
        <ThemedPagination
          current={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={totalElements}
          onPageChange={onChange}
        />
      </div>
    );
  }

  return (
    <div className="admin-pagination-host user-select-none">
      <ul className="pagination pagination-sm justify-content-center my-2 admin-pagination">
        <li className={`page-item${currentPage === 1 ? ' disabled' : ''}`}>
          <a className="page-link" onClick={() => currentPage > 1 && onChange(currentPage - 1)}>&nbsp;&lt;&nbsp;</a>
        </li>
        {pages.map((page) => (
          <li className={`page-item${currentPage === page ? ' active' : ''}`} key={page}>
            <a className="page-link" onClick={() => currentPage !== page && onChange(page)}>{page}</a>
          </li>
        ))}
        <li className={`page-item${currentPage === totalPages ? ' disabled' : ''}`}>
          <a className="page-link" onClick={() => currentPage < totalPages && onChange(currentPage + 1)}>&nbsp;&gt;&nbsp;</a>
        </li>
      </ul>
    </div>
  );
}

function AdminDialog({
  bodyClassName = '',
  children,
  fullscreen = false,
  headerAction,
  headerClassName = '',
  initialFocusRef,
  nested = false,
  onClose,
  open,
  scrollable = false,
  size,
  staticBackdrop = false,
  title,
  titleClassName = '',
}: {
  bodyClassName?: string;
  children: ReactNode;
  fullscreen?: boolean;
  headerAction?: ReactNode;
  headerClassName?: string;
  initialFocusRef?: { current: HTMLElement | null };
  nested?: boolean;
  onClose: () => void;
  open: boolean;
  scrollable?: boolean;
  size?: 'lg';
  staticBackdrop?: boolean;
  title: string;
  titleClassName?: string;
}) {
  const contentClass = [
    'admin-dialog-content',
    'compat-modal',
    'fixed',
    'grid',
    'w-full',
    'bg-popover',
    'text-sm',
    'text-popover-foreground',
    'shadow-md',
    'outline-none',
    ...(
      fullscreen
        ? []
        : [
            'left-1/2',
            'top-1/2',
            '-translate-1/2',
            'max-w-[calc(100%-2rem)]',
            'rounded-[0.5rem]',
            'border',
            'border-border',
            'sm:max-w-[500px]',
          ]
    ),
    scrollable ? 'compat-scrollable' : '',
    size === 'lg' ? 'compat-lg' : '',
    nested ? 'admin-dialog-content-nested' : '',
    fullscreen ? 'admin-impersonation-dialog' : '',
  ].filter(Boolean).join(' ');

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !staticBackdrop) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className={contentClass}
        onEscapeKeyDown={(event) => staticBackdrop && event.preventDefault()}
        onInteractOutside={(event) => staticBackdrop && event.preventDefault()}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          initialFocusRef?.current?.focus();
        }}
        overlayClassName={`admin-dialog-overlay modal-backdrop fade show${nested ? ' admin-dialog-overlay-nested' : ''}`}
        overlayUnstyled
        showCloseButton={false}
        style={{ gap: 0, padding: 0 }}
        unstyled
      >
        <main
          className={`flex flex-col${fullscreen ? '' : ' space-y-4'}`}
          style={scrollable ? { display: 'block', overflow: 'auto' } : undefined}
        >
          <div className={`modal-header${headerClassName ? ` ${headerClassName}` : ''}`}>
            <DialogTitle asChild unstyled>
              <h5 className={`modal-title${titleClassName ? ` ${titleClassName}` : ''}`}>{title}</h5>
            </DialogTitle>
            {headerAction ?? (
              <button type="button" className="btn-close shadow-none" aria-label="Close" onClick={onClose} />
            )}
          </div>
          <div className={`modal-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
        </main>
      </DialogContent>
    </Dialog>
  );
}

function GameBanRow({
  data,
  extId,
  game,
  label,
  onDelete,
  onSave,
}: {
  data: AdminGameData;
  extId: number;
  game: GameKey;
  label: string;
  onDelete: (game: GameKey, extId: number) => void;
  onSave: (game: GameKey, extId: number, status: string) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState(String(game === 'ONGEKI' ? data.banStatus ?? 0 : data.banState ?? 0));
  return (
    <div className={`input-group input-group-sm${game === 'ONGEKI' ? '' : ' mb-1'}`}>
      <span className="input-group-text">{label}</span>
      <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="0">0</option>
        <option value="1">1</option>
        <option value="2">2</option>
      </select>
      <button type="button" className="btn btn-outline-primary" onClick={() => onSave(game, extId, status)}>{t('AdminPage.GameBan.Save')}</button>
      <button type="button" className="btn btn-outline-danger" onClick={() => onDelete(game, extId)}>{t('AdminPage.GameBan.DeleteSave')}</button>
    </div>
  );
}

export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AdminTab>('users');
  const [field, setField] = useState('all');
  const [pattern, setPattern] = useState('');
  const [users, setUsers] = useState<AdvancedUser[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');

  const [selectedItem, setSelectedItem] = useState<AdvancedUser | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<SupportProfile | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);
  const [rawJsonUsername, setRawJsonUsername] = useState('');
  const [cardAccessCode, setCardAccessCode] = useState('');
  const [cardExtId, setCardExtId] = useState('');
  const [oldAccessCode, setOldAccessCode] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');
  const supportRequestId = useRef(0);

  const [keychips, setKeychips] = useState<AdminKeychip[] | null>(null);
  const [keychipPattern, setKeychipPattern] = useState('');
  const [keychipPage, setKeychipPage] = useState(1);
  const [keychipTotal, setKeychipTotal] = useState(0);
  const [newKeychipId, setNewKeychipId] = useState('');
  const [newKeychipPlace, setNewKeychipPlace] = useState('');

  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null);
  const [loginAsPending, setLoginAsPending] = useState(false);
  const impersonationFrame = useRef<HTMLIFrameElement>(null);
  const impersonationRef = useRef<ImpersonationState | null>(null);
  const impersonationListenerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const loginAsFlightRef = useRef<Promise<void> | null>(null);
  const impersonationGenerationRef = useRef(0);
  const capturedRefreshTokensRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const unloadingRef = useRef(false);
  const impersonationCloseButtonRef = useRef<HTMLButtonElement>(null);
  const initialized = useRef(false);

  async function loadUsers(page: number, searchPattern: string, searchField: string) {
    setCurrentPage(page + 1);
    const params: Record<string, string | number> = { page, size: PAGE_SIZE, field: searchField || 'all' };
    if (searchPattern !== '') params.pattern = searchPattern;
    try {
      const response = await api.get('api/admin/advancedUserSearch', params) as ApiEnvelope<PageData<AdvancedUser>>;
      if (isOk(response) && response.data) {
        setUsers(response.data.content ?? []);
        setTotalElements(response.data.totalElements ?? 0);
      } else {
        notice(t('AdminPage.OperationFailed'), 'warning');
      }
    } catch {
      notice(t('Common.OperationFailed'), 'warning');
    } finally {
      setLoading(false);
    }
  }

  async function loadKeychips(page: number, searchPattern: string) {
    setKeychipPage(page + 1);
    const params: Record<string, string | number> = { page, size: PAGE_SIZE };
    if (searchPattern) params.pattern = searchPattern;
    try {
      const response = await api.get('api/admin/keychip', params) as ApiEnvelope<PageData<AdminKeychip>>;
      if (isOk(response) && response.data) {
        setKeychips(response.data.content ?? []);
        setKeychipTotal(response.data.totalElements ?? 0);
      }
    } catch {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void loadUsers(0, '', 'all');
    void loadKeychips(0, '');
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const onPageHide = () => {
      unloadingRef.current = true;
      teardownImpersonation(true);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('pagehide', onPageHide);
      teardownImpersonation(unloadingRef.current);
    };
  }, []);

  async function loadSupport(username: string) {
    const requestId = ++supportRequestId.current;
    try {
      const response = await api.get(`api/admin/accounts/${username}`) as ApiEnvelope<SupportResponse>;
      if (
        requestId === supportRequestId.current
        && (response?.status?.code === StatusCode.USER_FETCH_SUCCESS || isOk(response))
        && response.data
      ) {
        setSelectedProfile({
          ...response.data.account,
          oauthIdentities: response.data.oauthIdentities,
          passkeys: response.data.passkeys,
          totpEnabled: response.data.totpEnabled,
        });
      }
    } catch {
      // Legacy detail modal silently keeps the support-only fields empty.
    }
  }

  function openUser(item: AdvancedUser) {
    setSelectedItem(item);
    setSelectedProfile(null);
    setRawJson(null);
    setRawJsonUsername('');
    setCardAccessCode('');
    setCardExtId('');
    setOldAccessCode('');
    setNewAccessCode('');
    void loadSupport(item.user.username);
  }

  function closeUser() {
    supportRequestId.current += 1;
    setSelectedItem(null);
    setSelectedProfile(null);
    setRawJson(null);
    setRawJsonUsername('');
  }

  function openRawJson(item: AdvancedUser) {
    setRawJson(highlightJson(item));
    setRawJsonUsername(item.user.username);
  }

  async function refreshUsers() {
    await loadUsers(currentPage - 1, pattern, field);
  }

  async function createUser() {
    if (!createUsername || !createName || !createEmail || !createPassword) {
      notice(t('AdminPage.CompleteUserInfoRequired'), 'warning');
      return;
    }
    setCreatingUser(true);
    try {
      const response = await api.post('api/admin/createUser', {
        userName: createUsername,
        name: createName,
        email: createEmail,
        password: createPassword,
      }) as ApiEnvelope<unknown>;
      notice(t('AdminPage.OperationFailed'));
      if (isOk(response)) await refreshUsers();
    } catch {
      notice(t('Common.OperationFailed'), 'warning');
    } finally {
      setCreatingUser(false);
    }
  }

  function installImpersonationListener(session: ImpersonationState) {
    const listener = (event: MessageEvent) => {
      const current = impersonationRef.current;
      const frame = impersonationFrame.current;
      if (
        current !== session
        || event.origin !== window.location.origin
        || event.source !== frame?.contentWindow
        || event.data?.nonce !== session.nonce
        || event.data?.type !== IMPERSONATE_REQUEST
      ) return;
      (event.source as Window).postMessage({
        type: IMPERSONATE_GRANT,
        nonce: session.nonce,
        account: session.account,
      }, window.location.origin);
    };
    impersonationListenerRef.current = listener;
    window.addEventListener('message', listener);
  }

  async function performLoginAs(username: string, generation: number): Promise<void> {
    try {
      const response = await api.post(`api/admin/users/loginas/${username}`, {}) as ApiEnvelope<unknown>;
      const account = response?.data;
      if (!isOk(response) || !isAccount(account)) {
        if (mountedRef.current && generation === impersonationGenerationRef.current) {
          notice(t('AdminPage.OperationFailed'));
        }
        return;
      }

      // Capture every issued refresh token, including a response that arrives
      // after the page was closed or another impersonation superseded it.
      const refreshToken = account.refreshToken;
      if (
        !mountedRef.current
        || generation !== impersonationGenerationRef.current
        || impersonationRef.current
      ) {
        void revokeRefreshToken(refreshToken, unloadingRef.current).catch((error) => {
          console.warn('could not revoke late impersonated session', error);
        });
        return;
      }

      const nonce = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const session: ImpersonationState = {
        username,
        account,
        nonce,
        url: new URL(`/?imp=${encodeURIComponent(nonce)}`, window.location.origin).toString(),
      };
      capturedRefreshTokensRef.current.add(refreshToken);
      impersonationRef.current = session;
      // Install before mounting the iframe. The child also retries its request,
      // covering the brief interval before React assigns the iframe ref.
      installImpersonationListener(session);
      setImpersonation(session);
    } catch (error) {
      if (mountedRef.current && generation === impersonationGenerationRef.current) {
        notice(t('Common.OperationFailed'), 'warning');
        console.warn('login as fail', error);
      }
    }
  }

  function loginAs(username: string) {
    // This ref guard is synchronous, so a double click/Enter key before React
    // re-renders still produces only one loginas request.
    if (loginAsFlightRef.current || impersonationRef.current) return;
    unloadingRef.current = false;
    const generation = impersonationGenerationRef.current;
    setLoginAsPending(true);
    const flight = performLoginAs(username, generation);
    loginAsFlightRef.current = flight;
    void flight.then(
      () => {
        if (loginAsFlightRef.current === flight) loginAsFlightRef.current = null;
        if (mountedRef.current) setLoginAsPending(false);
      },
      () => {
        if (loginAsFlightRef.current === flight) loginAsFlightRef.current = null;
        if (mountedRef.current) setLoginAsPending(false);
      },
    );
  }

  function teardownImpersonation(keepalive = false) {
    const session = impersonationRef.current;
    const listener = impersonationListenerRef.current;
    const tokens = new Set(capturedRefreshTokensRef.current);
    if (session?.account.refreshToken) tokens.add(session.account.refreshToken);

    // Invalidate the identity and remove the listener first. Any queued
    // postMessage or late loginas response now fails the identity check.
    impersonationRef.current = null;
    impersonationGenerationRef.current += 1;
    impersonationListenerRef.current = null;
    if (listener) window.removeEventListener('message', listener);

    try {
      impersonationFrame.current?.contentWindow?.sessionStorage?.removeItem(IMPERSONATION_KEY);
      impersonationFrame.current?.contentWindow?.sessionStorage?.removeItem(IMPERSONATED_USER_KEY);
    } catch (error) {
      console.warn('could not clear impersonated frame session', error);
    }
    try {
      // Also clear any stale values in the parent browsing context. These keys
      // are never used for the administrator's normal account/user cache.
      sessionStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem(IMPERSONATED_USER_KEY);
    } catch (error) {
      console.warn('could not clear impersonated session', error);
    }

    capturedRefreshTokensRef.current.clear();
    if (mountedRef.current) {
      setImpersonation(null);
      setLoginAsPending(false);
    }
    for (const token of tokens) {
      void revokeRefreshToken(token, keepalive).catch((error) => {
        console.warn('could not revoke impersonated session', error);
      });
    }
  }

  function closeImpersonation() {
    teardownImpersonation(false);
  }

  async function setAccountBan(item: AdvancedUser, banned: boolean) {
    const warning = banned
      ? t('AdminPage.Confirm.BanAccount', { username: item.user.username })
      : t('AdminPage.Confirm.UnbanAccount', { username: item.user.username });
    if (!(await confirm(warning))) return;
    try {
      await api.post(`api/admin/accounts/${item.user.username}/${banned ? 'ban' : 'unban'}`, {});
      notice(t('AdminPage.OperationFailed'));
      await refreshUsers();
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function setGameBan(username: string, game: GameKey, extId: number, status: string) {
    try {
      const response = await api.put(`api/admin/accounts/${username}/games/${game}/${extId}/ban-state`, {
        status: Number(status),
      }) as ApiEnvelope<unknown>;
      notice(t('AdminPage.OperationFailed'));
      await refreshUsers();
      if (isOk(response) && selectedProfile?.username === username) await loadSupport(username);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function deleteGameSave(username: string, game: GameKey, extId: number) {
    const confirmation = window.prompt(
      t('AdminPage.Confirm.DeleteGameSave', { username, extId, game }),
    );
    if (confirmation !== String(extId)) return;
    try {
      const response = await api.delete(
        `api/admin/accounts/${username}/games/${game}/${extId}`,
        { confirmExtId: String(extId) },
      ) as ApiEnvelope<unknown>;
      notice(t('AdminPage.OperationFailed'));
      await refreshUsers();
      if (isOk(response) && selectedProfile?.username === username) await loadSupport(username);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function revokeSessions(username: string) {
    if (!(await confirm(t('AdminPage.Confirm.RevokeSessions', { username })))) return;
    try {
      await api.post(`api/admin/accounts/${username}/sessions/revoke`, {});
      notice(t('AdminPage.OperationFailed'));
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function deletePasskey(username: string, id: number) {
    if (!(await confirm(t('AdminPage.Confirm.DeletePasskey')))) return;
    try {
      await api.delete(`api/admin/accounts/${username}/passkeys/${id}`);
      await loadSupport(username);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function deleteOauth(username: string, id: number) {
    if (!(await confirm(t('AdminPage.Confirm.DeleteOauth')))) return;
    try {
      await api.delete(`api/admin/accounts/${username}/oauth/${id}`);
      await loadSupport(username);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function setDefaultCard(username: string, extId: number) {
    if (!(await confirm(t('AdminPage.Confirm.SetDefaultCard', { extId, username })))) return;
    try {
      await api.put(`api/admin/accounts/${username}/cards/${extId}/default`, {});
      await loadSupport(username);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function unbindCardByExtId(username: string, extId: number) {
    if (!(await confirm(t('AdminPage.Confirm.UnbindCard', { username, extId })))) return;
    try {
      await api.delete(`api/admin/accounts/${username}/cards/${extId}`);
      await Promise.all([loadSupport(username), refreshUsers()]);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function removeExternal(username: string, extId: number, luid: string) {
    if (!(await confirm(t('AdminPage.Confirm.RemoveExternal', { extId, luid })))) return;
    try {
      await api.delete(`api/admin/accounts/${username}/cards/${extId}/external/${luid}`);
      await loadSupport(username);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function resetTotp(username: string) {
    if (!(await confirm(t('AdminPage.Confirm.ResetTotp', { username })))) return;
    try {
      await api.delete(`api/admin/users/${username}/totp`);
      notice(t('AdminPage.OperationFailed'));
      setSelectedProfile((profile) => profile ? { ...profile, totpEnabled: false } : profile);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function cardOperation(path: string, body: Record<string, unknown>) {
    try {
      await api.post(path, body);
      notice(t('AdminPage.OperationFailed'));
      await refreshUsers();
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function bindCardViaExtId(username: string) {
    const parsed = Number(cardExtId);
    if (!cardExtId || Number.isNaN(parsed)) {
      notice(t('AdminPage.ValidExtIdRequired'), 'warning');
      return;
    }
    await cardOperation('api/admin/bindCardViaExtId', { userName: username, extId: parsed });
  }

  async function addKeychip() {
    if (!newKeychipId) {
      notice(t('AdminPage.KeychipIdRequired'), 'warning');
      return;
    }
    const body: Record<string, string> = { keychipId: newKeychipId };
    if (newKeychipPlace) body.placeName = newKeychipPlace;
    setNewKeychipId('');
    setNewKeychipPlace('');
    try {
      await api.post('api/admin/keychip', body);
      notice(t('AdminPage.OperationFailed'));
      await loadKeychips(keychipPage - 1, keychipPattern);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function deleteKeychip(id: number) {
    if (!(await confirm(t('AdminPage.Confirm.DeleteKeychip')))) return;
    try {
      await api.delete(`api/admin/keychip/${id}`);
      await loadKeychips(keychipPage - 1, keychipPattern);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  async function toggleWhiteList(keychipId: string) {
    try {
      await api.post('api/admin/keychip/toggleWhiteList', { keychipId });
      await loadKeychips(keychipPage - 1, keychipPattern);
    } catch (error) {
      notice(t('Common.OperationFailed'), 'warning');
    }
  }

  const selectedUsername = selectedItem?.user.username ?? '';

  return (
    <div className="admin-page">
      <h1 className="page-heading">{t('AdminPage.Title')}</h1>

      <div className="row justify-content-start align-items-center g-1 mb-2">
        <div className="col-auto">
          <button type="button" className={`tab-selector${tab === 'users' ? ' tab-selector-active' : ''}`} onClick={() => setTab('users')}>{t('AdminPage.Tab.Users')}</button>
        </div>
        <div className="col-auto">
          <button type="button" className={`tab-selector${tab === 'keychips' ? ' tab-selector-active' : ''}`} onClick={() => setTab('keychips')}>Keychip</button>
        </div>
      </div>

      {tab === 'users' && (
        <div>
          <div className="row mb-2 g-1">
            <div className="col-12 p-0">
              <div className="input-group input-group-sm">
                <select className="form-select flex-grow-0 w-auto" value={field} onChange={(event) => setField(event.target.value)}>
                  <option value="all">{t('AdminPage.Field.All')}</option>
                  <option value="username">{t('AdminPage.Field.Username')}</option>
                  <option value="name">{t('AdminPage.Field.Name')}</option>
                  <option value="email">{t('AdminPage.Field.Email')}</option>
                  <option value="game">{t('AdminPage.Field.GameName')}</option>
                  <option value="card">{t('AdminPage.Field.Card')}</option>
                  <option value="extId">ExtId</option>
                </select>
                <input
                  type="text"
                  className="form-control"
                  placeholder={t('AdminPage.Placeholder.Search')}
                  value={pattern}
                  onChange={(event) => setPattern(event.target.value)}
                  onKeyUp={(event) => event.key === 'Enter' && void loadUsers(0, pattern, field)}
                />
              </div>
            </div>
          </div>
          <div className="row mb-2 g-1">
            <div className="col-12 p-0">
              <button type="button" className="btn btn-primary btn-sm w-100" onClick={() => void loadUsers(0, pattern, field)}>{t('AdminPage.Search')}</button>
            </div>
          </div>
          <div className="row mb-2 g-1">
            <div className="col-12 p-0">
              <button type="button" className="btn btn-outline-primary btn-sm w-100" onClick={() => setCreateUserOpen(true)}>{t('AdminPage.CreateUser')}</button>
            </div>
          </div>
          {!loading && <Pagination currentPage={currentPage} totalElements={totalElements} onChange={(page) => void loadUsers(page - 1, pattern, field)} />}
          {users && (
            <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-2">
              {users.map((item) => (
                <div className="col" key={item.user.id}>
                  <div className="card h-100 card-btn user-select-none" onClick={() => openUser(item)}>
                    <div className="card-header fw-bold">{item.user.id}.{item.user.username}</div>
                    <div className="card-body small">
                      <span className={`badge mb-1 ${isBanned(item) ? 'bg-danger' : 'bg-success'}`}>
                        {isBanned(item) ? t('AdminPage.Banned') : t('AdminPage.Normal')}
                      </span>
                      <div>{item.user.name}</div>
                      <div>{item.user.email}</div>
                      {(item.user.oauth2s ?? []).map((oauth) => <div key={oauth.id}>{oauth.email}</div>)}
                      {(item.gameProfiles ?? []).map((profile, index) => (
                        <div key={`${profile.card?.extId ?? 'card'}-${index}`}>
                          {profile.ongeki && <div>{profile.ongeki.userName}</div>}
                          {profile.chusan && <div>{profile.chusan.userName}</div>}
                          {profile.maimai2 && <div>{profile.maimai2.userName}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && <Pagination currentPage={currentPage} totalElements={totalElements} onChange={(page) => void loadUsers(page - 1, pattern, field)} />}
        </div>
      )}

      {tab === 'keychips' && (
        <div>
          <div className="input-group input-group-sm mb-2">
            <input
              type="text"
              className="form-control"
              placeholder={t('AdminPage.Placeholder.KeychipSearch')}
              value={keychipPattern}
              onChange={(event) => setKeychipPattern(event.target.value)}
              onKeyUp={(event) => event.key === 'Enter' && void loadKeychips(0, keychipPattern)}
            />
            <button type="button" className="btn btn-primary" onClick={() => void loadKeychips(0, keychipPattern)}>{t('AdminPage.Search')}</button>
          </div>
          <div className="input-group input-group-sm mb-2">
            <input type="text" className="form-control" placeholder="Keychip ID" value={newKeychipId} onChange={(event) => setNewKeychipId(event.target.value)} />
            <input type="text" className="form-control" placeholder={t('AdminPage.Placeholder.PlaceName')} value={newKeychipPlace} onChange={(event) => setNewKeychipPlace(event.target.value)} />
            <button type="button" className="btn btn-primary" onClick={() => void addKeychip()}>{t('AdminPage.Add')}</button>
          </div>
          {keychips && (
            <div className="card mb-4">
              <div className="table-responsive">
                <table className="table table-sm table-hover small mb-0 align-middle">
                  <thead><tr><th>ID</th><th>Keychip</th><th>{t('AdminPage.KeychipTable.User')}</th><th>{t('AdminPage.KeychipTable.Place')}</th><th>{t('AdminPage.KeychipTable.WhiteList')}</th><th /></tr></thead>
                  <tbody>
                    {keychips.map((keychip) => (
                      <tr key={keychip.id}>
                        <td>{keychip.id}</td>
                        <td>{keychip.keychipId}</td>
                        <td>{keychip.user?.name ?? '-'}</td>
                        <td>{keychip.placeName}</td>
                        <td>
                          <span className={`badge rounded-pill ${keychip.whiteListed ? 'bg-success' : 'bg-secondary'}`}>
                            {keychip.whiteListed ? t('AdminPage.WhiteListed') : t('AdminPage.NotWhiteListed')}
                          </span>
                        </td>
                        <td className="text-end">
                          <button type="button" className="btn btn-outline-primary btn-sm me-1" onClick={() => void toggleWhiteList(keychip.keychipId)}>{t('AdminPage.ToggleWhiteList')}</button>
                          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void deleteKeychip(keychip.id)}>{t('AdminPage.Delete')}</button>
                        </td>
                      </tr>
                    ))}
                    {keychips.length === 0 && <tr><td colSpan={6} className="text-center text-secondary">{t('AdminPage.NoData')}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {keychips && <Pagination currentPage={keychipPage} totalElements={keychipTotal} onChange={(page) => void loadKeychips(page - 1, keychipPattern)} />}
        </div>
      )}

      <AdminDialog open={createUserOpen} onClose={() => setCreateUserOpen(false)} title={t('AdminPage.CreateUser')}>
        <div className="d-grid gap-2">
          <input type="text" className="form-control form-control-sm" placeholder={t('AdminPage.Placeholder.Username')} value={createUsername} onChange={(event) => setCreateUsername(event.target.value)} />
          <input type="text" className="form-control form-control-sm" placeholder={t('AdminPage.Placeholder.Name')} value={createName} onChange={(event) => setCreateName(event.target.value)} />
          <input type="email" className="form-control form-control-sm" placeholder={t('AdminPage.Placeholder.Email')} value={createEmail} onChange={(event) => setCreateEmail(event.target.value)} />
          <input type="password" className="form-control form-control-sm" placeholder={t('AdminPage.Placeholder.Password')} value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} />
          <button
            type="button"
            className={`btn btn-primary btn-sm${creatingUser ? ' disabled' : ''}`}
            onClick={() => {
              void createUser();
              setCreateUserOpen(false);
            }}
          >{t('AdminPage.Create')}</button>
        </div>
      </AdminDialog>

      <AdminDialog open={selectedItem !== null} onClose={closeUser} title={selectedUsername} scrollable>
        {selectedItem && (
          <>
            <div className="table-responsive mb-3">
              <table className="table table-sm small mb-0 align-middle"><tbody>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">ID</th><td>{selectedItem.user.id}</td>
                  <th className="text-nowrap text-secondary fw-normal">{t('AdminPage.Field.Username')}</th><td>{selectedItem.user.username}</td>
                </tr>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">{t('AdminPage.Field.Name')}</th><td>{selectedItem.user.name}</td>
                  <th className="text-nowrap text-secondary fw-normal">{t('AdminPage.Field.Email')}</th><td className="text-break">{selectedItem.user.email}</td>
                </tr>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">{t('AdminPage.RegisteredAt')}</th><td>{formatJoinedAt(selectedProfile?.joinedAt)}</td>
                  <th className="text-nowrap text-secondary fw-normal">{t('AdminPage.TwoFactor')}</th>
                  <td><span className={`badge rounded-pill ${selectedProfile?.totpEnabled ? 'bg-success' : 'bg-secondary'}`}>{selectedProfile?.totpEnabled ? t('AdminPage.Enabled') : t('AdminPage.Disabled')}</span></td>
                </tr>
                <tr>
                  <th className="text-nowrap text-secondary fw-normal">{t('AdminPage.Roles')}</th>
                  <td>{selectedItem.user.roles?.length ? selectedItem.user.roles.map((role) => role.name).join(t('Common.ListSeparator')) : '—'}</td>
                  <th className="text-nowrap text-secondary fw-normal">{t('AdminPage.LinkedAccounts')}</th>
                  <td>
                    {selectedItem.user.oauth2s?.length
                      ? selectedItem.user.oauth2s.map((oauth) => <div className="text-break" key={oauth.id}>{oauth.provider}{t('Common.Colon')}{oauth.email}</div>)
                      : '—'}
                  </td>
                </tr>
              </tbody></table>
            </div>
            <div className="fw-bold small mb-1">{t('AdminPage.CardsAndProfiles')}</div>
            <div className="table-responsive mb-3">
              <table className="table table-sm small mb-0 align-middle">
                <thead><tr><th className="text-nowrap">ExtId</th><th className="text-nowrap">Access Code</th><th className="text-nowrap">{t('AdminPage.LinkedAccessCode')}</th><th className="text-nowrap">{t('AdminPage.Default')}</th><th className="text-nowrap">CHUNITHM</th><th className="text-nowrap">O.N.G.E.K.I.</th><th className="text-nowrap">maimai DX</th></tr></thead>
                <tbody>
                  {selectedItem.gameProfiles.map((profile, index) => (
                    <tr key={`${profile.card?.extId ?? 'card'}-${index}`}>
                      <td className="text-nowrap">{profile.card?.extId}</td>
                      <td className="text-nowrap font-monospace">{profile.card?.luid}</td>
                      <td className="font-monospace">
                        {profile.card?.cardExternalList?.length
                          ? profile.card.cardExternalList.map((external) => <div className="text-nowrap" key={external.id}>{external.luid}</div>)
                          : <span className="text-secondary">—</span>}
                      </td>
                      <td>{profile.card?.default ? '✓' : ''}</td>
                      <td>{profile.chusan ? <>{profile.chusan.userName} <span className="text-secondary">({formatRating(profile.chusan.playerRating)})</span></> : <span className="text-secondary">—</span>}</td>
                      <td>{profile.ongeki ? <>{profile.ongeki.userName} <span className="text-secondary">({formatRating(profile.ongeki.playerRating)})</span></> : <span className="text-secondary">—</span>}</td>
                      <td>{profile.maimai2 ? <>{profile.maimai2.userName} <span className="text-secondary">({profile.maimai2.playerRating})</span></> : <span className="text-secondary">—</span>}</td>
                    </tr>
                  ))}
                  {!selectedItem.gameProfiles.length && <tr><td colSpan={7} className="text-center text-secondary">{t('AdminPage.NoCards')}</td></tr>}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm mb-2 me-1"
              disabled={loginAsPending || impersonation !== null}
              aria-busy={loginAsPending}
              onClick={() => loginAs(selectedUsername)}
            >{t('AdminPage.Impersonate')}</button>
            {!isAdminTarget(selectedItem) && (
              <button type="button" className={`btn btn-sm mb-2 me-1 ${isBanned(selectedItem) ? 'btn-success' : 'btn-danger'}`} onClick={() => void setAccountBan(selectedItem, !isBanned(selectedItem))}>
                {isBanned(selectedItem) ? t('AdminPage.UnbanAccount') : t('AdminPage.BanAccount')}
              </button>
            )}
            <button type="button" className="btn btn-outline-warning btn-sm mb-2 me-1" onClick={() => void revokeSessions(selectedUsername)}>{t('AdminPage.RevokeAllSessions')}</button>
            {selectedProfile?.totpEnabled && <button type="button" className="btn btn-outline-danger btn-sm mb-2 me-1" onClick={() => void resetTotp(selectedUsername)}>{t('AdminPage.ResetTwoFactor')}</button>}
            <button type="button" className="btn btn-outline-secondary btn-sm mb-2" onClick={() => openRawJson(selectedItem)}>{t('AdminPage.RawJson')}</button>
            <hr className="my-2" />
            <div className="fw-bold small mb-1">{t('AdminPage.GameBanSection')}</div>
            {selectedItem.gameProfiles.map((profile, index) => (
              <div className="border rounded p-2 mb-2" key={`ops-${profile.card.extId}-${index}`}>
                <div className="small fw-bold mb-1">ExtId {profile.card.extId}</div>
                {profile.chusan && <GameBanRow data={profile.chusan} extId={profile.card.extId} game="CHUSAN" label="Chusan" onSave={(game, extId, status) => void setGameBan(selectedUsername, game, extId, status)} onDelete={(game, extId) => void deleteGameSave(selectedUsername, game, extId)} />}
                {profile.maimai2 && <GameBanRow data={profile.maimai2} extId={profile.card.extId} game="MAIMAI2" label="Maimai2" onSave={(game, extId, status) => void setGameBan(selectedUsername, game, extId, status)} onDelete={(game, extId) => void deleteGameSave(selectedUsername, game, extId)} />}
                {profile.ongeki && <GameBanRow data={profile.ongeki} extId={profile.card.extId} game="ONGEKI" label="Ongeki" onSave={(game, extId, status) => void setGameBan(selectedUsername, game, extId, status)} onDelete={(game, extId) => void deleteGameSave(selectedUsername, game, extId)} />}
              </div>
            ))}
            {Boolean(selectedProfile?.passkeys?.length || selectedProfile?.oauthIdentities?.length) && (
              <>
                <div className="fw-bold small mb-1">{t('AdminPage.CredentialRecovery')}</div>
                {selectedProfile?.passkeys?.map((passkey) => <button type="button" className="btn btn-outline-danger btn-sm me-1 mb-1" key={passkey.id} onClick={() => void deletePasskey(selectedUsername, passkey.id)}>{t('AdminPage.DeletePasskeyButton', { nick: passkey.nick })}</button>)}
                {selectedProfile?.oauthIdentities?.map((oauth) => <button type="button" className="btn btn-outline-danger btn-sm me-1 mb-1" key={oauth.id} onClick={() => void deleteOauth(selectedUsername, oauth.id)}>{t('AdminPage.UnlinkOauthButton', { provider: oauth.provider, email: oauth.email })}</button>)}
              </>
            )}
            <hr className="my-2" />
            <div className="fw-bold small mb-1">{t('AdminPage.CardOperations')}</div>
            <div className="input-group input-group-sm mb-2">
              <input type="text" className="form-control" placeholder={t('AdminPage.Placeholder.AccessCode')} value={cardAccessCode} onChange={(event) => setCardAccessCode(event.target.value)} />
              <button type="button" className="btn btn-outline-primary" onClick={() => void cardOperation('api/admin/bindCard', { userName: selectedUsername, accessCode: cardAccessCode })}>{t('AdminPage.Bind')}</button>
              <button type="button" className="btn btn-outline-danger" onClick={() => void cardOperation('api/admin/unbindCard', { userName: selectedUsername, accessCode: cardAccessCode })}>{t('AdminPage.Unbind')}</button>
            </div>
            <div className="input-group input-group-sm mb-2">
              <input type="text" className="form-control" placeholder={t('AdminPage.ExtIdPlaceholder')} value={cardExtId} onChange={(event) => setCardExtId(event.target.value)} />
              <button type="button" className="btn btn-outline-primary" onClick={() => void bindCardViaExtId(selectedUsername)}>{t('AdminPage.BindViaExtId')}</button>
            </div>
            <div className="input-group input-group-sm mb-2">
              <input type="text" className="form-control" placeholder={t('AdminPage.Placeholder.OldAccessCode')} value={oldAccessCode} onChange={(event) => setOldAccessCode(event.target.value)} />
              <input type="text" className="form-control" placeholder={t('AdminPage.Placeholder.NewAccessCode')} value={newAccessCode} onChange={(event) => setNewAccessCode(event.target.value)} />
              <button type="button" className="btn btn-outline-primary" onClick={() => void cardOperation('api/admin/changeAccessCode', { userName: selectedUsername, accessCode: oldAccessCode, newAccessCode })}>{t('AdminPage.ChangeAccessCode')}</button>
            </div>
            {(selectedProfile?.cards ?? []).map((card) => (
              <div className="border rounded p-2 mb-2 small" key={card.extId}>
                <div className="fw-bold">ExtId {card.extId} {card.defaultCard ? t('AdminPage.DefaultMark') : ''}</div>
                <button type="button" className="btn btn-outline-primary btn-sm me-1" onClick={() => void setDefaultCard(selectedUsername, card.extId)}>{t('AdminPage.SetDefault')}</button>
                <button type="button" className="btn btn-outline-danger btn-sm me-1" onClick={() => void unbindCardByExtId(selectedUsername, card.extId)}>{t('AdminPage.UnbindByExtId')}</button>
                {(card.externalLuids ?? []).map((luid) => <button type="button" className="btn btn-outline-danger btn-sm me-1" key={luid} onClick={() => void removeExternal(selectedUsername, card.extId, luid)}>{t('AdminPage.DeleteLuid', { luid })}</button>)}
              </div>
            ))}
          </>
        )}
      </AdminDialog>

      <AdminDialog
        open={rawJson !== null}
        onClose={() => {
          setRawJson(null);
          setRawJsonUsername('');
        }}
        title={t('AdminPage.RawJsonTitle', { username: rawJsonUsername })}
        scrollable
        size="lg"
        nested
      >
        <pre className="json-view small mb-0" dangerouslySetInnerHTML={{ __html: rawJson ?? '' }} />
      </AdminDialog>

      <AdminDialog
        bodyClassName="p-0"
        fullscreen
        headerAction={(
          <button
            ref={impersonationCloseButtonRef}
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={closeImpersonation}
          >{t('AdminPage.ReturnToAdmin')}</button>
        )}
        headerClassName="py-2 d-flex align-items-center"
        initialFocusRef={impersonationCloseButtonRef}
        onClose={closeImpersonation}
        open={impersonation !== null}
        staticBackdrop
        title={t('AdminPage.ImpersonationTitle', { username: impersonation?.username ?? '' })}
        titleClassName="me-auto"
      >
        {impersonation && <iframe ref={impersonationFrame} className="impersonation-frame" src={impersonation.url} title={`Impersonating ${impersonation.username}`} />}
      </AdminDialog>
    </div>
  );
}
