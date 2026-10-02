import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { LiquidButton } from '../../src/components/LiquidButton';
import { BRAND_TINT } from '../../src/components/tints';
import { PressableScale } from '../../src/components/PressableScale';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { useSounds } from '../../src/data/useSounds';
import { usePlayer } from '../../src/context/PlayerContext';
import { useLocalSounds } from '../../src/context/LocalSoundsContext';
import { useBottomSpace } from '../../src/lib/useBottomSpace';

const CATS = [
  { key: 'all', label: 'All' },
  { key: 'meme', label: '😂 Meme' },
  { key: 'music', label: '🎵 Music' },
  { key: 'trending', label: '🔥 Trending' },
  { key: 'local', label: '📱 My Sounds' },
];

export default function Home() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const remote = useSounds();
  const { localSounds, importSounds } = useLocalSounds();
  const { play } = usePlayer();
  const bottom = useBottomSpace();
  const [cat, setCat] = useState('all');
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const sounds = [...localSounds, ...remote];
  const list = cat === 'all' ? sounds : sounds.filter((x) => x.category === cat);
  const hero = remote.find((x) => x.category === 'trending') ?? remote[0];

  const onImport = async () => {
    try {
      const { added, skipped, skippedTitles } = await importSounds();
      if (added) setCat('local');
      if (skipped) {
        const names = skippedTitles.slice(0, 3).map((n) => `"${n}"`).join(', ') + (skipped > 3 ? ` and ${skipped - 3} more` : '');
        setNotice({
          title: skipped === 1 ? "Can't add this song" : "Can't add these songs",
          message: `${names} ${skipped === 1 ? 'is' : 'are'} already in your library. Each title can only be added once.`,
        });
      }
    } catch {
      setNotice({ title: 'Import failed', message: 'Could not read that file. Try another audio file.' });
    }
  };

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
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <SoundRow sound={item} queue={list} />}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: bottom }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={s.empty}>{cat === 'local' ? 'No imported sounds yet. Tap the + button to pick audio from your phone.' : 'No sounds'}</Text>
        }
        ListHeaderComponent={
          <View>
            <View style={s.top}>
              <View>
                <Text style={s.h1}>Soundly<Text style={{ color: t.accent2 }}>.</Text></Text>
                <Text style={s.sub}>Sounds for every moment</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
              <ThemeToggle />
              <LiquidButton compact style={s.badge} onPress={onImport} accessibilityRole="button" accessibilityLabel="Import audio from phone">
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
          </View>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.lg },
  h1: { fontSize: 34, fontWeight: '800', color: t.text, letterSpacing: -0.8 },
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
