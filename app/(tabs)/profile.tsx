import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../../src/theme';
import { Glass } from '../../src/components/Glass';
import { GlassButton } from '../../src/components/GlassButton';
import { ThemePicker } from '../../src/components/ThemeToggle';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { useBottomSpace } from '../../src/lib/useBottomSpace';

export default function Profile() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { session } = useAuth();
  const router = useRouter();
  const bottom = useBottomSpace();
  return (
    <SafeAreaView style={[s.screen, { paddingBottom: bottom }]}>
      <Glass radius={32} intensity={50} style={{ alignSelf: 'stretch' }}>
        <View style={s.card}>
          <Text style={{ fontSize: 56 }}>👤</Text>
          <Text style={s.h}>{session ? session.user.email : 'Guest'}</Text>
          <Text style={s.muted}>{session ? 'Your favorites are synced' : 'Login to sync favorites'}</Text>
          <Text style={s.section}>APPEARANCE</Text>
          <ThemePicker />
          {session ? (
            <GlassButton variant="glass" label="Log out" onPress={() => supabase.auth.signOut()} style={s.btn} />
          ) : (
            <GlassButton label="Login" onPress={() => router.push('/login')} style={s.btn} />
          )}
        </View>
      </Glass>
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  card: { alignItems: 'center', padding: space.xl },
  h: { fontSize: 20, fontWeight: '700', color: t.text, marginTop: space.sm },
  muted: { color: t.muted, marginTop: 4 },
  section: { color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: space.xl, marginBottom: space.sm, alignSelf: 'flex-start' },
  btn: { marginTop: space.lg, alignSelf: 'stretch' },
});
