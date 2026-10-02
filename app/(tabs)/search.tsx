import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Palette, space, useTheme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { Glass } from '../../src/components/Glass';
import { useSounds } from '../../src/data/useSounds';
import { useLocalSounds } from '../../src/context/LocalSoundsContext';
import { useBottomSpace } from '../../src/lib/useBottomSpace';

export default function Search() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const remote = useSounds();
  const { localSounds } = useLocalSounds();
  const sounds = [...localSounds, ...remote]; // My Sounds are searchable too
  const bottom = useBottomSpace();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const list = needle ? sounds.filter((x) => [x.title, x.artist, x.album].some((v) => v?.toLowerCase().includes(needle))) : sounds;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <Text style={s.h1}>Search</Text>
      <Glass radius={t.radius} intensity={50} style={s.box}>
        <View style={s.boxInner}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput
            style={s.input}
            placeholder="Search title or artist..."
            placeholderTextColor={t.muted}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={t.accent2}
          />
          {q.length > 0 && <Ionicons name="close-circle" size={18} color={t.muted} onPress={() => setQ('')} />}
        </View>
      </Glass>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <SoundRow sound={item} queue={list} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: bottom }}
        ListEmptyComponent={<Text style={s.empty}>No sounds found</Text>}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  h1: { fontSize: 34, fontWeight: '800', color: t.text, letterSpacing: -0.8, paddingHorizontal: space.lg, paddingTop: space.sm },
  box: { height: 50, marginHorizontal: space.lg, marginVertical: space.md },
  boxInner: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  input: { flex: 1, marginLeft: 8, color: t.text, fontSize: 16 },
  empty: { textAlign: 'center', color: t.muted, marginTop: 40 },
});
