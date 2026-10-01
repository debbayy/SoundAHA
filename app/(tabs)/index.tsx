import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { useSounds } from '../../src/data/useSounds';

const CATS = [
  { key: 'all', label: 'All' },
  { key: 'meme', label: '😂 Meme' },
  { key: 'music', label: '🎵 Music' },
  { key: 'trending', label: '🔥 Trending' },
];

export default function Home() {
  const sounds = useSounds();
  const [cat, setCat] = useState('all');
  const list = cat === 'all' ? sounds : sounds.filter((x) => x.category === cat);

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <SoundRow sound={item} />}
        contentContainerStyle={{ padding: 20 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 16 }}>
            <Text style={s.h1}>Soundly</Text>
            <Text style={s.sub}>Sounds for every moment</Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  chipOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  chipText: { color: theme.text, fontWeight: '600' },
});
