import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Slot, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PageHost } from '../components/ui/navigator';
import { OverlayHost } from '../components/ui/overlay';
import { AppState, AppStateProvider, useAppState } from '../services/appState';
import { AppTheme } from '../theme/appTheme';

const appState = new AppState();

/// Auth redirect: signed-out users only reach /login (and the public
/// QR evaluation page); signed-in users never see /login.
function AuthGate({ children }: { children: React.ReactNode }) {
  const state = useAppState();
  const router = useRouter();
  const loc = usePathname();
  const loggedIn = state.isLoggedIn;

  const target = loc.startsWith('/eval/')
    ? null // public QR landing page — no auth
    : !loggedIn && loc !== '/login'
      ? '/login'
      : loggedIn && (loc === '/login' || loc === '/')
        ? '/dashboard'
        : null;

  useEffect(() => {
    if (target != null) router.replace(target as never);
  }, [target, router]);

  if (target != null) return <View style={{ flex: 1, backgroundColor: AppTheme.bgColor }} />;
  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    MaterialIcons: require('../../assets/fonts/MaterialIcons-Regular.otf'),
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Restore the saved session, giving up after 5 seconds.
    Promise.race([
      appState.tryAutoLogin(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
    ]).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fontsLoaded || !ready) return <View style={{ flex: 1, backgroundColor: AppTheme.bgColor }} />;

  return (
    <SafeAreaProvider>
      <AppStateProvider value={appState}>
        <StatusBar style="dark" />
        <View style={{ flex: 1, backgroundColor: AppTheme.bgColor }}>
          <AuthGate>
            <Slot />
          </AuthGate>
          <PageHost />
        </View>
        <OverlayHost />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
