import { createContext, ReactNode, useContext } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Services } from '@shared/services';
import { TokenStore } from '@shared/services/ApiClient';
import { SessionController } from '@shared/controllers/SessionController';
import { NotificationController } from '@shared/controllers/NotificationController';
import { useControllerState } from './hooks';

/** Mobile token storage. */
class AsyncStorageTokenStore implements TokenStore {
  private static readonly KEY = 'tasknet_token';
  get() { return AsyncStorage.getItem(AsyncStorageTokenStore.KEY).catch(() => null); }
  async set(token: string) { await AsyncStorage.setItem(AsyncStorageTokenStore.KEY, token); }
  async clear() { await AsyncStorage.removeItem(AsyncStorageTokenStore.KEY); }
}

/**
 * API base: EXPO_PUBLIC_API_BASE, else the gateway (port 8000) on the machine
 * running the Expo dev server — a phone can't reach "localhost" on the PC.
 */
function apiBase(): string {
  const env = process.env.EXPO_PUBLIC_API_BASE;
  if (env) return env;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:8000`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:8000`;
}

/** Public site for links that open outside the app (QR evaluation page). */
export function webOrigin(): string {
  const env = process.env.EXPO_PUBLIC_WEB_ORIGIN;
  if (env) return env;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:5173`;
}

export class AppModel {
  readonly services = new Services(apiBase(), new AsyncStorageTokenStore());
  readonly session = new SessionController(this.services);
  readonly notifications = new NotificationController(this.services);
}

export const appModel = new AppModel();
const Ctx = createContext<AppModel>(appModel);

export function AppProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={appModel}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
export const useServices = () => useContext(Ctx).services;

export function useSession() {
  const app = useContext(Ctx);
  return { ...useControllerState(app.session), session: app.session };
}

export function useMediaUrl() {
  const api = useContext(Ctx).services.api;
  return (p: string | null | undefined) => api.mediaUrl(p);
}
