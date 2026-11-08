import { ReactNode } from 'react';
import { View } from 'react-native';
import { Redirect, usePathname, useGlobalSearchParams } from 'expo-router';
import { useSession } from './AppModel';
import { C, Spinner } from '../ui/kit';

/**
 * Signed-in screens only. A signed-out visitor goes to the login and comes
 * back here afterwards (e.g. after opening an attendance QR link).
 */
export function RequireAuth({ children, perm }: { children: ReactNode; perm?: string }) {
  const { user, restoring } = useSession();
  const path = usePathname();
  const params = useGlobalSearchParams();
  if (restoring) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><Spinner /></View>;
  if (!user) {
    const query = Object.entries(params).filter(([, v]) => typeof v === 'string').map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    return <Redirect href={{ pathname: '/login', params: { from: query ? `${path}?${query}` : path } }} />;
  }
  // Pages the backend did not grant this session fall back to the dashboard.
  if (perm && !user.can(perm)) return <Redirect href="/dashboard" />;
  return <>{children}</>;
}
