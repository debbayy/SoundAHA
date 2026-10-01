import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { theme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { useSounds } from '../../src/data/useSounds';
import { useAuth } from '../../src/context/AuthContext';

export default function Favorites() {
  const sounds = useSounds();
  const { session, favs } = useAuth();
  const router = useRouter();
  const list = sounds.filter((x) => favs.includes(x.id));

  if (!session) {
    return (
      <SafeAreaView style={[s.screen, s.center]}>
        <Text style={{ fontSize: 48 }}>❤️</Text>
        <Text style={s.h2}>Save your favorites</Text>
        <Text style={s.muted}>Login to save sounds and sync across devices</Text>
        <Pressable style={s.btn} onPress={() => router.push('/login')}><Text style={s.btnText}>Login</Text></Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <SoundRow sound={item} />}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={<View style={{ marginBottom: 16 }}><Text style={s.h1}>Your Favorites</Text><Text style={s.muted}>{list.length} saved sounds</Text></View>}
        ListEmptyComponent={<Text style={[s.muted, { textAlign: 'center', marginTop: 40 }]}>Tap ♡ on a sound to save it</Text>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  h1: { fontSize: 28, fontWeight: '800', color: theme.text },
  h2: { fontSize: 20, fontWeight: '700', color: theme.text, marginTop: 12 },
  muted: { color: theme.muted, marginTop: 4, textAlign: 'center' },
  btn: { marginTop: 20, backgroundColor: theme.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: theme.radius },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
