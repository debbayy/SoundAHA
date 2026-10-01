import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { LocalSoundsProvider } from '../src/context/LocalSoundsContext';
import { PlayerProvider } from '../src/context/PlayerContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <LocalSoundsProvider>
        <PlayerProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" options={{ presentation: 'modal' }} />
          </Stack>
        </PlayerProvider>
      </LocalSoundsProvider>
    </AuthProvider>
  );
}
