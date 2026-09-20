import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { useFonts as useGeistFonts, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { SessionProvider } from '@/lib/session';
import { ImageRasterizerProvider } from '@/lib/rasterizer';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [interLoaded, interError] = useFonts({ Inter_400Regular, Inter_500Medium });
  const [geistLoaded, geistError] = useGeistFonts({ Geist_500Medium, Geist_600SemiBold });

  const ready = (interLoaded || interError) && (geistLoaded || geistError);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ImageRasterizerProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="capture" options={{ animation: 'fade_from_bottom' }} />
              <Stack.Screen name="review" />
              <Stack.Screen name="filter" />
              <Stack.Screen name="pages" />
              <Stack.Screen name="export" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="document/[id]" />
            </Stack>
          </ImageRasterizerProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
