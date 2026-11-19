import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UpdatePrompt } from '@/features/updates/UpdatePrompt';
import { WebShell } from '@/features/web/WebShell';
import { initI18n } from '@/lib/i18n';
import { capabilities } from '@/lib/platform/capabilities';
import { initSound, setMusicWanted } from '@/lib/sound';
import { palette } from '@/ui/theme';

initI18n();
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  useEffect(() => {
    initSound();
    setMusicWanted(true);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <WebShell>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: palette.grape },
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            {/* App-only screens: the web game (online play only) can't open them, not
                even from a typed URL; its buttons show "Available in the app" instead. */}
            <Stack.Protected guard={capabilities.appFeatures}>
              <Stack.Screen name="game" options={{ gestureEnabled: false }} />
              <Stack.Screen name="results" options={{ animation: 'fade', gestureEnabled: false }} />
              <Stack.Screen name="levels" />
              <Stack.Screen name="setup" />
              <Stack.Screen name="my-boards/index" />
              <Stack.Screen name="my-boards/new" />
              <Stack.Screen name="my-boards/[boardId]" />
              <Stack.Screen name="my-boards/crop" />
            </Stack.Protected>
          </Stack>
        </WebShell>
        <UpdatePrompt />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.grape },
});
