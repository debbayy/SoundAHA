import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GRADIENT, theme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { useSounds } from '../../src/data/useSounds';
import { usePlayer } from '../../src/context/PlayerContext';
import { useLocalSounds } from '../../src/context/LocalSoundsContext';

const CATS = [
  { key: 'all', label: 'All' },
  { key: 'meme', label: '😂 Meme' },
  { key: 'music', label: '🎵 Music' },
  { key: 'trending', label: '🔥 Trending' },
  { key: 'local', label: '📱 My Sounds' },
];

export default function Home() {
  const remote = useSounds();
  const { localSounds, importSounds } = useLocalSounds();
  const { play } = usePlayer();
  const [cat, setCat] = useState('all');
  const sounds = [...localSounds, ...remote];
  const list = cat === 'all' ? sounds : sounds.filter((x) => x.category === cat);
  const hero = remote.find((x) => x.category === 'trending') ?? remote[0];

  const onImport = async () => {
    try {
      const n = await importSounds();
      if (n) setCat('local');
    } catch {
      Alert.alert('Import failed', 'Could not read that file. Try another audio file.');
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <SoundRow sound={item} />}
        contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={s.empty}>{cat === 'local' ? 'No imported sounds yet. Tap the + button to pick audio from your phone.' : 'No sounds'}</Text>
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <View style={s.top}>
              <View>
                <Text style={s.h1}>Soundly<Text style={{ color: theme.accent2 }}>.</Text></Text>
                <Text style={s.sub}>Sounds for every moment</Text>
              </View>
              <Pressable onPress={onImport} accessibilityLabel="Import audio from phone">
                <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.badge}>
                  <Ionicons name="add" size={24} color="#fff" />
                </LinearGradient>
              </Pressable>
            </View>

            {hero && (
              <Pressable onPress={() => play(hero)}>
                <LinearGradient colors={['#7C5CFF', '#3B2BCC', '#00B8D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heroTag}>TRENDING NOW</Text>
                    <Text style={s.heroTitle} numberOfLines={1}>{hero.title}</Text>
                    <Text style={s.heroSub}>Tap to play instantly</Text>
                  </View>
                  <Text style={{ fontSize: 44, marginRight: 14 }}>{hero.emoji ?? '🔥'}</Text>
                  <View style={s.heroBtn}><Ionicons name="play" size={22} color={theme.accent} style={{ marginLeft: 2 }} /></View>
                </LinearGradient>
              </Pressable>
            )}

            <View style={s.chips}>
              {CATS.map((c) => {
                const on = cat === c.key;
                return (
                  <Pressable key={c.key} onPress={() => setCat(c.key)}>
                    {on ? (
                      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.chip}>
                        <Text style={[s.chipText, { color: '#fff' }]}>{c.label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[s.chip, s.chipOff]}><Text style={s.chipText}>{c.label}</Text></View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  h1: { fontSize: 32, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  sub: { color: theme.muted, marginTop: 2 },
  badge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  empty: { color: theme.muted, textAlign: 'center', marginTop: 40 },
  hero: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 26 },
  heroTag: { color: 'rgba(255,255,255,0.75)', fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.7)', marginTop: 4, fontSize: 12 },
  heroBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 22, marginBottom: 6 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  chipOff: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  chipText: { color: theme.text, fontWeight: '600', fontSize: 13 },
});
