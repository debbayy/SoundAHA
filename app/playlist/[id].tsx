import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../../src/theme';
import { usePlayer } from '../../src/context/PlayerContext';
import { useLibrary } from '../../src/context/LibraryContext';
import { useLocalSounds } from '../../src/context/LocalSoundsContext';
import { useSounds } from '../../src/data/useSounds';
import { resolveIds } from '../../src/lib/library';
import { Backdrop } from '../../src/components/Backdrop';
import { LiquidButton } from '../../src/components/LiquidButton';
import { GlassButton } from '../../src/components/GlassButton';
import { TrackRow } from '../../src/components/TrackRow';
import { PlayerMenu } from '../../src/components/PlayerMenu';
import { PromptDialog } from '../../src/components/PromptDialog';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';

export default function PlaylistScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { playlists, renamePlaylist, deletePlaylist, removeFromPlaylist } = useLibrary();
  const { localSounds } = useLocalSounds();
  const remote = useSounds();
  const { current, playing, play, setMode } = usePlayer();
  const pl = playlists.lists.find((p) => p.id === id);
  const songs = useMemo(() => (pl ? resolveIds(pl.ids, [localSounds, remote], playlists.online) : []), [pl, localSounds, remote, playlists.online]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fromMenu = (fn: () => void) => { setMenuOpen(false); setTimeout(fn, Platform.OS === 'ios' ? 350 : 0); };

  // deleted (here or elsewhere): leave the screen
  useEffect(() => { if (!pl) router.back(); }, [pl]);
  if (!pl) return null;

  const playAll = (shuffle: boolean) => {
    if (!songs.length) return;
    setMode({ shuffle });
    // with shuffle, start from a random song too
    const first = shuffle ? songs[Math.floor(Math.random() * songs.length)] : songs[0];
    play(first, songs);
    router.push('/player');
  };

  return (
    <Backdrop>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.top}>
          <LiquidButton compact hitSlop={10} style={s.round} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={24} color={t.btnText} />
          </LiquidButton>
          <LiquidButton compact hitSlop={10} style={s.round} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Playlist options">
            <Ionicons name="ellipsis-vertical" size={20} color={t.btnText} />
          </LiquidButton>
        </View>

        <FlatList
          data={songs}
          keyExtractor={(x) => x.id}
          initialNumToRender={10}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xl }}
          ListHeaderComponent={
            <View style={{ marginBottom: space.md }}>
              <Text style={s.h1} numberOfLines={2}>{pl.name}</Text>
              <Text style={s.sub}>{songs.length} {songs.length === 1 ? 'song' : 'songs'}</Text>
              {songs.length > 0 && (
                <View style={s.actions}>
                  <GlassButton label="Play" onPress={() => playAll(false)} style={{ flex: 1 }} />
                  <GlassButton variant="glass" label="Shuffle" onPress={() => playAll(true)} style={{ flex: 1 }} />
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TrackRow
              sound={item}
              current={current?.id === item.id}
              playing={playing}
              onPress={() => play(item, songs)}
              onRemove={() => removeFromPlaylist(pl.id, item.id)}
              removeLabel="Remove from playlist"
            />
          )}
          ListEmptyComponent={<Text style={s.empty}>No songs yet. Long-press any song and choose "Add to playlist".</Text>}
        />

        <PlayerMenu
          visible={menuOpen}
          top={insets.top + space.sm + 50}
          onClose={() => setMenuOpen(false)}
          items={[
            { key: 'rename', icon: 'create-outline', label: 'Rename', onPress: () => fromMenu(() => setRenaming(true)) },
            { key: 'delete', icon: 'trash-outline', label: 'Delete playlist', onPress: () => fromMenu(() => setDeleting(true)) },
          ]}
        />
        <PromptDialog
          visible={renaming}
          title="Rename playlist"
          initial={pl.name}
          onCancel={() => setRenaming(false)}
          onSubmit={(name) => { renamePlaylist(pl.id, name); setRenaming(false); }}
        />
        <ConfirmDialog
          visible={deleting}
          title="Delete playlist"
          message={`Delete "${pl.name}"? The songs themselves stay in your library.`}
          confirmLabel="Delete"
          onCancel={() => setDeleting(false)}
          onConfirm={() => { setDeleting(false); deletePlaylist(pl.id); }}
        />
      </View>
    </Backdrop>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1 },
    top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
    round: { width: 44, height: 44 },
    h1: { fontSize: 30, fontWeight: '800', color: t.text, letterSpacing: -0.6 },
    sub: { color: t.muted, marginTop: 2, fontSize: 14 },
    actions: { flexDirection: 'row', gap: 10, marginTop: space.md },
    empty: { color: t.muted, textAlign: 'center', marginTop: space.xl, paddingHorizontal: space.lg, lineHeight: 20 },
  });
