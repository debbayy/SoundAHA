import { useEffect, useMemo } from 'react';
import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { AuthProvider } from '../src/context/AuthContext';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { LocalSoundsProvider } from '../src/context/LocalSoundsContext';
import { PlayerProvider } from '../src/context/PlayerContext';
import { Backdrop } from '../src/components/Backdrop';
import { useTheme } from '../src/theme';

export default function RootLayout() {
  const t = useTheme();

  // The navigation theme must follow the app theme, otherwise react-navigation paints its own
  // (light) background behind the screens.
  const navTheme = useMemo(() => {
    const base = t.isDark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: t.bg, card: t.bg, text: t.text, border: t.border, primary: t.accent } };
  }, [t]);

  // Native window background (visible during transitions / behind transparent screens).
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg).catch(() => {});
  }, [t]);

  return (
    <AuthProvider>
      <FavoritesProvider>
        <LocalSoundsProvider>
          <PlayerProvider>
            <ThemeProvider value={navTheme}>
              <StatusBar style={t.isDark ? 'light' : 'dark'} />
              <Backdrop>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
                  <Stack.Screen
                    name="player"
                    options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: t.bg } }}
                  />
                  <Stack.Screen
                    name="login"
                    options={{ presentation: 'modal', animation: 'slide_from_bottom', contentStyle: { backgroundColor: t.bg } }}
                  />
                </Stack>
              </Backdrop>
            </ThemeProvider>
          </PlayerProvider>
        </LocalSoundsProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
