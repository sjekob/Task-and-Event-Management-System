import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { configureApi } from '@tasknet/shared';

const TOKEN_KEY = 'tasknet_token';

/**
 * Where the FastAPI backend lives. On a phone "localhost" is the phone itself,
 * so set EXPO_PUBLIC_API_BASE to the computer's LAN address (see README).
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000';

/** Where the React web app lives; QR codes and evaluation links point there. */
export const WEB_BASE = process.env.EXPO_PUBLIC_WEB_BASE ?? 'http://localhost:5173';

// SecureStore has no web implementation; the web preview falls back to localStorage.
const store = Platform.OS === 'web'
  ? {
    get: async () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
    set: async (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* session only */ } },
    clear: async () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
  }
  : {
    get: () => SecureStore.getItemAsync(TOKEN_KEY),
    set: (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t),
    clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  };

configureApi({ baseUrl: API_BASE, tokenStore: store });
