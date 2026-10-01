import { Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/lib/supabase';

export default function Profile() {
  const { session } = useAuth();
  const router = useRouter();
  return (
    <SafeAreaView style={s.screen}>
      <Text style={{ fontSize: 56 }}>👤</Text>
      <Text style={s.h}>{session ? session.user.email : 'Guest'}</Text>
      <Text style={s.muted}>{session ? 'Your favorites are synced' : 'Login to sync favorites'}</Text>
      {session ? (
        <Pressable style={[s.btn, s.outline]} onPress={() => supabase.auth.signOut()}><Text style={[s.btnText, { color: theme.accent }]}>Log out</Text></Pressable>
      ) : (
        <Pressable style={s.btn} onPress={() => router.push('/login')}><Text style={s.btnText}>Login</Text></Pressable>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  h: { fontSize: 20, fontWeight: '700', color: theme.text, marginTop: 12 },
  muted: { color: theme.muted, marginTop: 4 },
  btn: { marginTop: 24, backgroundColor: theme.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: theme.radius },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.accent },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
