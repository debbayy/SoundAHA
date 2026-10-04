import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { useSounds } from '../../src/data/useSounds';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { useLocalSounds } from '../../src/context/LocalSoundsContext';
import { resolveFavs } from '../../src/lib/favorites';
import { supabaseReady } from '../../src/lib/supabase';
import { useBottomSpace } from '../../src/lib/useBottomSpace';

export default function Favorites() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const sounds = useSounds();
  const { localSounds } = useLocalSounds();
  const { favs } = useFavorites();
  const { session } = useAuth();
  const router = useRouter();
  const bottom = useBottomSpace();
  const list = useMemo(() => resolveFavs(favs, [localSounds, sounds]), [favs, localSounds, sounds]);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        // render only what fits on screen first, so switching to this tab shows it right away
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        renderItem={({ item }) => <SoundRow sound={item} queue={list} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: bottom }}
        ListHeaderComponent={
          <View style={{ marginBottom: space.md }}>
            <Text style={s.h1}>Favorites</Text>
            <Text style={s.sub}>{list.length} saved sounds</Text>
            {supabaseReady && !session && (
              <Pressable onPress={() => router.push('/login')} hitSlop={8} accessibilityRole="button">
                <Text style={s.link}>Login to sync favorites across devices</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={<Text style={[s.sub, { textAlign: 'center', marginTop: 40 }]}>Tap ♡ on a sound to save it</Text>}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  h1: { fontSize: 34, fontWeight: '800', color: t.text, letterSpacing: -0.8 },
  sub: { color: t.muted, marginTop: 2, fontSize: 14 },
  link: { color: t.accent2, marginTop: space.sm, fontSize: 13, fontWeight: '700' },
});
