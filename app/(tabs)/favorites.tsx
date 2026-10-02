import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { Glass } from '../../src/components/Glass';
import { GlassButton } from '../../src/components/GlassButton';
import { useSounds } from '../../src/data/useSounds';
import { useAuth } from '../../src/context/AuthContext';
import { useBottomSpace } from '../../src/lib/useBottomSpace';

export default function Favorites() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const sounds = useSounds();
  const { session, favs } = useAuth();
  const router = useRouter();
  const bottom = useBottomSpace();
  const list = sounds.filter((x) => favs.includes(x.id));

  if (!session) {
    return (
      <SafeAreaView style={[s.screen, s.center, { paddingBottom: bottom }]}>
        <Glass radius={32} intensity={50} style={s.card}>
          <View style={s.cardInner}>
            <Text style={{ fontSize: 48 }}>❤️</Text>
            <Text style={s.h2}>Save your favorites</Text>
            <Text style={s.muted}>Login to save sounds and sync across devices</Text>
            <GlassButton label="Login" onPress={() => router.push('/login')} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
          </View>
        </Glass>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <SoundRow sound={item} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: bottom }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            <Text style={s.h1}>Favorites</Text>
            <Text style={s.sub}>{list.length} saved sounds</Text>
          </View>
        }
        ListEmptyComponent={<Text style={[s.sub, { textAlign: 'center', marginTop: 40 }]}>Tap ♡ on a sound to save it</Text>}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  card: { alignSelf: 'stretch' },
  cardInner: { alignItems: 'center', padding: space.xl },
  h1: { fontSize: 34, fontWeight: '800', color: t.text, letterSpacing: -0.8 },
  h2: { fontSize: 20, fontWeight: '700', color: t.text, marginTop: space.sm },
  sub: { color: t.muted, marginTop: 2, fontSize: 14 },
  muted: { color: t.muted, marginTop: 4, textAlign: 'center' },
});
