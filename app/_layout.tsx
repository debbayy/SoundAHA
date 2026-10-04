import { useEffect, useMemo } from 'react';
import { Stack, DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { AuthProvider } from '../src/context/AuthContext';
import { FavoritesProvider } from '../src/context/FavoritesContext';
import { LibraryProvider } from '../src/context/LibraryContext';
import { PartyProvider } from '../src/context/PartyContext';
import { LocalSoundsProvider } from '../src/context/LocalSoundsContext';
import { PlayerProvider } from '../src/context/PlayerContext';
import { Backdrop } from '../src/components/Backdrop';
import { SoundActionsHost } from '../src/components/SoundActions';
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
        <LibraryProvider>
          <LocalSoundsProvider>
            <PlayerProvider>
              <PartyProvider>
                <ThemeProvider value={navTheme}>
                  <StatusBar style={t.isDark ? 'light' : 'dark'} />
                  <Backdrop>
                    {/* One light transition for every page: a short native fade with a slight rise (runs off the JS
                        thread, smooth on slow phones). Pages are opaque so the page underneath, with its tab bar, can't
                        show through while it animates; only the tabs are see-through, to show the backdrop. */}
                    <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', animationDuration: 220, contentStyle: { backgroundColor: t.bg } }}>
                      <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
                      <Stack.Screen name="player" options={{ presentation: 'fullScreenModal' }} />
                      <Stack.Screen name="queue" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="login" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="party" options={{ presentation: 'modal' }} />
                    </Stack>
                    <SoundActionsHost />
                  </Backdrop>
                </ThemeProvider>
              </PartyProvider>
            </PlayerProvider>
          </LocalSoundsProvider>
        </LibraryProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}
