import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { useSounds } from '../../src/data/useSounds';
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
  const [cat, setCat] = useState('all');
  const sounds = [...localSounds, ...remote];
  const list = cat === 'all' ? sounds : sounds.filter((x) => x.category === cat);

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
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={
          <Text style={s.empty}>{cat === 'local' ? 'No imported sounds yet. Tap Import to pick audio from your phone.' : 'No sounds'}</Text>
        }
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <View style={s.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.h1}>Soundly</Text>
                <Text style={s.sub}>Sounds for every moment</Text>
              </View>
              <Pressable onPress={onImport} style={s.importBtn} accessibilityLabel="Import audio from phone">
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={s.importText}>Import</Text>
              </Pressable>
            </View>
            <View style={s.chips}>
              {CATS.map((c) => (
                <Pressable key={c.key} onPress={() => setCat(c.key)} style={[s.chip, cat === c.key && s.chipOn]}>
                  <Text style={[s.chipText, cat === c.key && { color: '#fff' }]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  h1: { fontSize: 30, fontWeight: '800', color: theme.text },
  sub: { color: theme.muted, marginTop: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  importBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.accent, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  importText: { color: '#fff', fontWeight: '700' },
  empty: { color: theme.muted, textAlign: 'center', marginTop: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  chipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { color: theme.text, fontWeight: '600' },
});
