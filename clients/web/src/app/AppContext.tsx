import { createContext, ReactNode, useContext } from 'react';
import { Services } from '@shared/services';
import { TokenStore } from '@shared/services/ApiClient';
import { SessionController } from '@shared/controllers/SessionController';
import { NotificationController } from '@shared/controllers/NotificationController';
import { useControllerState } from './hooks';

/** Web token storage (the Flutter app used SharedPreferences → localStorage, same key). */
class LocalStorageTokenStore implements TokenStore {
  private static readonly KEY = 'tasknet_token';

  async get() {
    try {
      return localStorage.getItem(LocalStorageTokenStore.KEY);
    } catch {
      return null;
    }
  }

  async set(token: string) {
    try {
      localStorage.setItem(LocalStorageTokenStore.KEY, token);
    } catch {
      /* private mode: token lives in memory only */
    }
  }

  async clear() {
    try {
      localStorage.removeItem(LocalStorageTokenStore.KEY);
    } catch {
      /* ignore */
    }
  }
}

/** API base: VITE_API_BASE, else the gateway on the same host as the page. */
function apiBase(): string {
  const env = import.meta.env.VITE_API_BASE as string | undefined;
  if (env) return env;
  return `${window.location.protocol}//${window.location.hostname}:8000`;
}

/** The app-wide objects: services plus the session and notification controllers. */
export class AppModel {
  readonly services = new Services(apiBase(), new LocalStorageTokenStore());
  readonly session = new SessionController(this.services);
  readonly notifications = new NotificationController(this.services);
}

export const appModel = new AppModel();

const Ctx = createContext<AppModel>(appModel);

export function AppProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={appModel}>{children}</Ctx.Provider>;
}

export function useApp(): AppModel {
  return useContext(Ctx);
}

export function useServices(): Services {
  return useContext(Ctx).services;
}

/** The session state (signed-in user etc.); re-renders on change. */
export function useSession() {
  const app = useContext(Ctx);
  const state = useControllerState(app.session);
  return { ...state, session: app.session };
}

/** Absolute URL for server-relative media. */
export function useMediaUrl() {
  const api = useContext(Ctx).services.api;
  return (p: string | null | undefined) => api.mediaUrl(p);
}
