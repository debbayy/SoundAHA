import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { PlayerProvider } from '../src/context/PlayerContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PlayerProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" options={{ presentation: 'modal' }} />
        </Stack>
      </PlayerProvider>
    </AuthProvider>
  );
}
