import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold, useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AppProvider, appModel } from '../core/AppModel';
import { FeedbackProvider } from '../ui/feedback';
import { C, FONT, Spinner } from '../ui/kit';

/** Root: fonts, providers, session restore, and the stack that detail screens push onto. */
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold,
  });
  useEffect(() => { void appModel.session.restore(); }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><Spinner /></View>;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <FeedbackProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{
              headerStyle: { backgroundColor: '#fff' },
              headerTitleStyle: { fontFamily: FONT[700], fontSize: 17, color: C.text },
              headerTintColor: C.text,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: C.bg },
            }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(main)" options={{ headerShown: false }} />
              <Stack.Screen name="eval/[eventId]" options={{ title: 'Event Evaluation' }} />
            </Stack>
          </FeedbackProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
