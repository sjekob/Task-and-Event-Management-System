import '@/lib/api';

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider, useSession } from '@tasknet/shared';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootStack />
      </SessionProvider>
    </QueryClientProvider>
  );
}

function RootStack() {
  const { user, restoring } = useSession();

  useEffect(() => {
    if (!restoring) void SplashScreen.hideAsync();
  }, [restoring]);

  // Keep the splash screen up while the stored token is checked.
  if (restoring) return null;
  const signedIn = !!user;

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text,
      headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: colors.bg },
      headerBackButtonDisplayMode: 'minimal',
    }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
        <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan attendance' }} />
        <Stack.Screen name="profile" options={{ title: 'My profile' }} />
        <Stack.Screen name="appraisal" options={{ title: 'My performance' }} />
        <Stack.Screen name="personnel/index" options={{ title: 'Personnel' }} />
        <Stack.Screen name="personnel/[id]" options={{ title: 'Profile' }} />
        <Stack.Screen name="audit-log" options={{ title: 'Audit log' }} />
      </Stack.Protected>
    </Stack>
  );
}
