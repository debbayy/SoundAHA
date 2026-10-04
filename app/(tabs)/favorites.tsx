import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../../src/theme';
import { Sound } from '../../src/types';
import { SoundRow } from '../../src/components/SoundRow';
import { LiquidButton } from '../../src/components/LiquidButton';
import { PromptDialog } from '../../src/components/PromptDialog';
import { BRAND_TINT } from '../../src/components/tints';
import { useSounds } from '../../src/data/useSounds';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { useLibrary } from '../../src/context/LibraryContext';
import { useLocalSounds } from '../../src/context/LocalSoundsContext';
import { resolveFavs } from '../../src/lib/favorites';
import { Playlist } from '../../src/lib/library';
import { supabaseReady } from '../../src/lib/supabase';
import { useBottomSpace } from '../../src/lib/useBottomSpace';

type Section = 'favorites' | 'playlists';
const VIEWS: { key: Section; label: string }[] = [
  { key: 'favorites', label: '❤️ Favorites' },
  { key: 'playlists', label: '🎶 Playlists' },
];

export default function Saved() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const sounds = useSounds();
  const { localSounds } = useLocalSounds();
  const { favs } = useFavorites();
  const { playlists, createPlaylist } = useLibrary();
  const { session } = useAuth();
  const router = useRouter();
  const bottom = useBottomSpace();
  const [view, setView] = useState<Section>('favorites');
  const [naming, setNaming] = useState(false);
  const favList = useMemo(() => resolveFavs(favs, [localSounds, sounds]), [favs, localSounds, sounds]);

  const header = (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.h1}>Saved</Text>
      <View style={s.chips}>
        {VIEWS.map((v) => {
          const on = view === v.key;
          return (
            <LiquidButton
              key={v.key}
              compact
              scaleTo={0.94}
              tint={on ? BRAND_TINT : undefined}
              label={v.label}
              labelStyle={s.chipText}
              style={s.chip}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => { if (!on) Haptics.selectionAsync().catch(() => {}); setView(v.key); }}
            />
          );
        })}
      </View>
      {view === 'favorites' ? (
        <>
          <Text style={s.sub}>{favList.length} saved sounds</Text>
          {supabaseReady && !session && (
            <Pressable onPress={() => router.push('/login')} hitSlop={8} accessibilityRole="button">
              <Text style={s.link}>Login to sync favorites across devices</Text>
            </Pressable>
          )}
        </>
      ) : (
        <Pressable onPress={() => setNaming(true)} style={({ pressed }) => [s.newRow, pressed && { opacity: 0.6 }]} accessibilityRole="button">
          <View style={[s.cover, s.newCover]}><Ionicons name="add" size={26} color={t.accent2} /></View>
          <Text style={[s.plName, { color: t.accent2 }]}>New playlist</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      {view === 'favorites' ? (
        <FlatList<Sound>
          key="favorites"
          data={favList}
          keyExtractor={(x) => x.id}
          // render only what fits on screen first, so switching to this tab shows it right away
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          renderItem={({ item }) => <SoundRow sound={item} queue={favList} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: bottom }}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text style={s.empty}>Tap ♡ on a sound to save it</Text>}
        />
      ) : (
        <FlatList<Playlist>
          key="playlists"
          data={playlists.lists}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/playlist/${item.id}`)} style={({ pressed }) => [s.plRow, pressed && { opacity: 0.6 }]} accessibilityRole="button">
              <View style={s.cover}><Ionicons name="musical-notes" size={22} color={t.text} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.plName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.plSub}>{item.ids.length} {item.ids.length === 1 ? 'song' : 'songs'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.muted} />
            </Pressable>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: bottom }}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text style={s.empty}>No playlists yet. Create one, or long-press any song and choose "Add to playlist".</Text>}
        />
      )}
      <PromptDialog
        visible={naming}
        title="New playlist"
        placeholder="Playlist name"
        confirmLabel="Create"
        onCancel={() => setNaming(false)}
        onSubmit={(name) => {
          setNaming(false);
          router.push(`/playlist/${createPlaylist(name)}`);
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  h1: { fontSize: 34, fontWeight: '800', color: t.text, letterSpacing: -0.8 },
  chips: { flexDirection: 'row', gap: 8, marginTop: space.md, marginBottom: space.md },
  chip: { height: 38, paddingHorizontal: space.md },
  chipText: { fontWeight: '600', fontSize: 13 },
  sub: { color: t.muted, fontSize: 14 },
  link: { color: t.accent2, marginTop: space.sm, fontSize: 13, fontWeight: '700' },
  empty: { color: t.muted, textAlign: 'center', marginTop: 40, paddingHorizontal: space.lg, lineHeight: 20 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  cover: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.fillStrong },
  newCover: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.accent2, backgroundColor: 'transparent' },
  plName: { fontSize: 16, fontWeight: '700', color: t.text },
  plSub: { fontSize: 12, color: t.muted, marginTop: 2 },
});
