import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { auth } from './api/endpoints';
import { getToken, setUnauthorizedHandler } from './api/client';
import type { Permission, Role, SessionUser } from './types';
import { jwtExpiryMs } from './utils/session';

type DraftSaver = () => Promise<void>;

export interface Session {
  user: SessionUser | null;
  /** true until the stored token has been checked at startup */
  restoring: boolean;
  /** Set when the session ended because the token expired (not a manual logout). */
  sessionExpired: boolean;
  /**
   * Signs in. Resolves to the roles to choose from when the account holds
   * several and none was given (call again with `role`), else null.
   */
  login(username: string, password: string, role?: Role): Promise<Role[] | null>;
  logout(): Promise<void>;
  /** Re-reads the signed-in user (e.g. after editing one's own profile). */
  refresh(): Promise<void>;
  can(permission: Permission): boolean;
  /**
   * A screen with unsaved, draftable work registers a saver; it runs while
   * the token is still valid, right before a logout or token expiry.
   */
  registerDraftSaver(save: DraftSaver): () => void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const draftSaver = useRef<DraftSaver | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runDraftSaver = async () => {
    try {
      await draftSaver.current?.();
    } catch {
      /* best effort */
    }
  };

  const endSession = useCallback(async (expired: boolean) => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    await runDraftSaver(); // while the token is still valid
    await auth.logout();
    setUser(null);
    setSessionExpired(expired);
  }, []);

  /** Fire ~1 minute before the JWT expires so a draft can still be saved. */
  const scheduleExpiry = useCallback(async () => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    const exp = jwtExpiryMs(await getToken());
    if (exp == null) return;
    const delay = exp - 60_000 - Date.now();
    if (delay <= 0) {
      await endSession(true);
      return;
    }
    // setTimeout overflows past ~24.8 days; JWTs here live far shorter.
    expiryTimer.current = setTimeout(() => void endSession(true), Math.min(delay, 2_000_000_000));
  }, [endSession]);

  useEffect(() => {
    setUnauthorizedHandler(() => void endSession(true));
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (await getToken()) {
          const me = await auth.me();
          if (!cancelled) {
            setUser(me);
            await scheduleExpiry();
          }
        }
      } catch {
        /* no valid stored session */
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [scheduleExpiry]);

  const value = useMemo<Session>(() => ({
    user,
    restoring,
    sessionExpired,
    async login(username, password, role) {
      setSessionExpired(false);
      const res = await auth.login(username, password, role);
      if ('needs_role_selection' in res) return res.available_roles;
      setUser(res.user);
      await scheduleExpiry();
      return null;
    },
    logout: () => endSession(false),
    async refresh() {
      setUser(await auth.me());
    },
    can: (p) => !!user?.permissions?.includes(p),
    registerDraftSaver(save) {
      draftSaver.current = save;
      return () => {
        if (draftSaver.current === save) draftSaver.current = null;
      };
    },
  }), [user, restoring, sessionExpired, scheduleExpiry, endSession]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside <SessionProvider>');
  return s;
}

/** The signed-in user; only for screens rendered behind the login gate. */
export function useUser(): SessionUser {
  const { user } = useSession();
  if (!user) throw new Error('useUser called without a signed-in user');
  return user;
}
