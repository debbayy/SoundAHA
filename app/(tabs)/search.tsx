import { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { useSounds } from '../../src/data/useSounds';

export default function Search() {
  const sounds = useSounds();
  const [q, setQ] = useState('');
  const list = sounds.filter((x) => x.title.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <View style={s.box}>
        <Ionicons name="search" size={18} color={theme.muted} />
        <TextInput style={s.input} placeholder="Search sounds..." placeholderTextColor={theme.muted} value={q} onChangeText={setQ} autoCorrect={false} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <SoundRow sound={item} />}
        contentContainerStyle={{ paddingHorizontal: 20 }}
        ListEmptyComponent={<Text style={s.empty}>No sounds found</Text>}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  box: { flexDirection: 'row', alignItems: 'center', margin: 20, paddingHorizontal: 14, height: 48, borderRadius: theme.radius, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  input: { flex: 1, marginLeft: 8, color: theme.text, fontSize: 16 },
  empty: { textAlign: 'center', color: theme.muted, marginTop: 40 },
});
