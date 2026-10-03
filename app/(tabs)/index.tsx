import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { AddDialog } from '../../src/components/AddDialog';
import { AlbumFolder } from '../../src/components/AlbumFolder';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { LiquidButton } from '../../src/components/LiquidButton';
import { BRAND_TINT } from '../../src/components/tints';
import { PressableScale } from '../../src/components/PressableScale';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useSounds } from '../../src/data/useSounds';
import { usePlayer } from '../../src/context/PlayerContext';
import { ImportResult, useLocalSounds } from '../../src/context/LocalSoundsContext';
import { Album } from '../../src/types';
import { useBottomSpace } from '../../src/lib/useBottomSpace';

const CATS = [
  { key: 'all', label: 'All' },
  { key: 'meme', label: '😂 Meme' },
  { key: 'music', label: '🎵 Music' },
  { key: 'trending', label: '🔥 Trending' },
  { key: 'local', label: '📱 My Sounds' },
];

type Notice = { title: string; message: string };

const names = (list: string[]) => list.slice(0, 3).map((n) => `"${n}"`).join(', ') + (list.length > 3 ? ` and ${list.length - 3} more` : '');

// Turns what an import did into a message, or null when everything was added without a problem.
function describe(r: ImportResult): Notice | null {
  if (r.cancelled) return null;
  if (r.albumTaken) return { title: 'Album already exists', message: `An album named "${r.albumName}" is already in your library.` };
  if (r.empty) return { title: 'No .mp3 files', message: `The folder "${r.albumName}" has no .mp3 files, so no album was made.` };

  const lines: string[] = [];
  if (r.added) lines.push(`${r.added} ${r.added === 1 ? 'song' : 'songs'} added.`);
  const dup = r.skippedTitles.length;
  if (dup) lines.push(`${names(r.skippedTitles)} ${dup === 1 ? 'is' : 'are'} already in your library. Each title can only be added once.`);
  const bad = r.rejected.length;
  if (bad) lines.push(`${names(r.rejected)} ${bad === 1 ? "isn't a valid .mp3 file" : "aren't valid .mp3 files"}, so ${bad === 1 ? 'it was' : 'they were'} skipped.`);
  if (!dup && !bad) return null;
  return { title: r.added ? 'Some files were skipped' : 'Nothing was added', message: lines.join('\n\n') };
}

export default function Home() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const remote = useSounds();
  const { localSounds, albums, importSongs, importAlbum, removeAlbum } = useLocalSounds();
  const { play, stopIf } = usePlayer();
  const bottom = useBottomSpace();
  const focused = useIsFocused();
  const [cat, setCat] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Album | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Songs that live in an album are shown inside its folder, not loose in the lists.
  const loose = localSounds.filter((x) => !x.album_id);
  const sounds = [...loose, ...remote];
  const openAlbum = albums.find((a) => a.id === openAlbumId) ?? null;
  const albumSongs = openAlbum ? localSounds.filter((x) => x.album_id === openAlbum.id) : [];
  const list = openAlbum ? albumSongs : cat === 'all' ? sounds : sounds.filter((x) => x.category === cat);
  const hero = remote.find((x) => x.category === 'trending') ?? remote[0];
  const showFolders = !openAlbum && cat === 'local' && albums.length > 0;

  // Android back inside an album goes back to the folders instead of leaving the tab.
  useEffect(() => {
    if (!openAlbum || !focused) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { setOpenAlbumId(null); return true; });
    return () => sub.remove();
  }, [openAlbum, focused]);

  // The "+" popup stays open while the system picker is up and is closed here once it returns, so
  // the picker is never opened while the popup is still closing.
  const importing = useRef(false);
  const run = async (pick: () => Promise<ImportResult>) => {
    if (importing.current) return; // a second tap while the picker is already open
    importing.current = true;
    try {
      const r = await pick();
      if (r.added) { setCat('local'); setOpenAlbumId(null); }
      const n = describe(r);
      if (n) setNotice(n);
    } catch (e) {
      const why = String((e as { message?: string })?.message ?? e).slice(0, 220);
      setNotice({ title: 'Import failed', message: `Could not read those files. Try again with .mp3 files.\n\n${why}` });
    } finally {
      importing.current = false;
      setAddOpen(false);
    }
  };

  const confirmDelete = () => {
    if (!deleting) return;
    removeAlbum(deleting.id).forEach(stopIf);
    setDeleting(null);
    setOpenAlbumId(null);
  };

  const header = openAlbum ? (
    <View style={s.top}>
      <LiquidButton compact style={s.badge} onPress={() => setOpenAlbumId(null)} accessibilityRole="button" accessibilityLabel="Back to My Sounds">
        <Ionicons name="chevron-back" size={24} color={t.btnText} />
      </LiquidButton>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Text style={s.albumName} numberOfLines={1}>{openAlbum.name}</Text>
        <Text style={s.sub}>{albumSongs.length} {albumSongs.length === 1 ? 'song' : 'songs'}  ·  Album</Text>
      </View>
      <LiquidButton compact style={s.badge} onPress={() => setDeleting(openAlbum)} accessibilityRole="button" accessibilityLabel="Delete album">
        <Ionicons name="trash-outline" size={20} color={t.btnText} />
      </LiquidButton>
    </View>
  ) : (
    <View>
      <View style={s.top}>
        <View>
          <Text style={s.h1}>Soundly<Text style={{ color: t.accent2 }}>.</Text></Text>
          <Text style={s.sub}>Sounds for every moment</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ThemeToggle />
          <LiquidButton compact style={s.badge} onPress={() => setAddOpen(true)} accessibilityRole="button" accessibilityLabel="Add songs or an album">
            <Ionicons name="add" size={26} color={t.btnText} />
          </LiquidButton>
        </View>
      </View>

      {hero && (
        <PressableScale
          scaleTo={0.97}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); play(hero, sounds); }}
        >
          <LinearGradient colors={['#7C5CFF', '#4A35D6', '#00B8D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 0.7 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.heroTag}>TRENDING NOW</Text>
              <Text style={s.heroTitle} numberOfLines={1}>{hero.title}</Text>
              <Text style={s.heroSub}>Tap to play instantly</Text>
            </View>
            <Text style={{ fontSize: 44, marginRight: space.md }}>{hero.emoji ?? '🔥'}</Text>
            <View style={s.heroBtn}><Ionicons name="play" size={22} color={t.accent} style={{ marginLeft: 2 }} /></View>
          </LinearGradient>
        </PressableScale>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chips}>
        {CATS.map((c) => {
          const on = cat === c.key;
          return (
            <LiquidButton
              key={c.key}
              compact
              scaleTo={0.94}
              tint={on ? BRAND_TINT : undefined}
              label={c.label}
              labelStyle={s.chipText}
              style={s.chip}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => { if (!on) Haptics.selectionAsync().catch(() => {}); setCat(c.key); }}
            />
          );
        })}
      </ScrollView>

      {showFolders && (
        <View>
          {albums.map((a) => (
            <AlbumFolder
              key={a.id}
              album={a}
              songs={localSounds.filter((x) => x.album_id === a.id)}
              onOpen={() => setOpenAlbumId(a.id)}
              onDelete={() => setDeleting(a)}
            />
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ConfirmDialog
        visible={!!notice}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />
      <ConfirmDialog
        visible={!!deleting}
        title="Delete album"
        message={`Delete "${deleting?.name ?? ''}" and all ${localSounds.filter((x) => x.album_id === deleting?.id).length} songs inside it?`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <AddDialog
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onSongs={() => run(importSongs)}
        onAlbum={() => run(importAlbum)}
      />
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <SoundRow sound={item} queue={list} />}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: bottom }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          showFolders ? null : (
            <Text style={s.empty}>{cat === 'local' && !openAlbum ? 'No imported sounds yet. Tap the + button to add songs or an album.' : 'No sounds'}</Text>
          )
        }
        ListHeaderComponent={header}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg },
  h1: { fontSize: 34, fontWeight: '800', color: t.text, letterSpacing: -0.8 },
  albumName: { fontSize: 26, fontWeight: '800', color: t.text, letterSpacing: -0.5 },
  sub: { color: t.muted, marginTop: 2, fontSize: 14 },
  badge: { width: 48, height: 48 },
  empty: { color: t.muted, textAlign: 'center', marginTop: 40 },
  hero: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: 28, overflow: 'hidden' },
  heroTag: { color: 'rgba(255,255,255,0.75)', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.72)', marginTop: 4, fontSize: 12 },
  heroBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipScroll: { marginHorizontal: -space.lg, marginTop: space.lg },
  chips: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: 8 },
  chip: { height: 38, paddingHorizontal: space.md },
  chipText: { fontWeight: '600', fontSize: 13 },
});
