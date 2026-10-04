import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Palette, space, useTheme } from '../../src/theme';
import { SoundRow } from '../../src/components/SoundRow';
import { Glass } from '../../src/components/Glass';
import { useSounds } from '../../src/data/useSounds';
import { useLocalSounds } from '../../src/context/LocalSoundsContext';
import { useBottomSpace } from '../../src/lib/useBottomSpace';
import { freesoundReady, searchFreesound } from '../../src/lib/freesound';
import { Sound } from '../../src/types';

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

  // Online results from Freesound, fetched once typing pauses (keeps within its rate limit).
  const [online, setOnline] = useState<Sound[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'limit'>('idle');
  useEffect(() => {
    setOnline([]);
    if (!needle || !freesoundReady) { setStatus('idle'); return; }
    setStatus('loading');
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchFreesound(needle, ctrl.signal)
        .then((r) => { setOnline(r); setStatus('idle'); })
        .catch((e) => { if (!ctrl.signal.aborted) setStatus(String(e).includes('rate-limited') ? 'limit' : 'error'); });
    }, 500);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [needle]);

  const sections = needle && freesoundReady
    ? [{ key: 'mine', title: '', data: list }, { key: 'online', title: 'From Freesound', data: online }]
    : [{ key: 'mine', title: '', data: list }];
  const onlineNote =
    status === 'loading' ? null
    : status === 'limit' ? 'Too many searches. Try again in a minute.'
    : status === 'error' ? "Couldn't reach Freesound. Check your connection."
    : !online.length ? 'No online sounds found' : null;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <Text style={s.h1}>Search</Text>
      <Glass radius={t.radius} intensity={50} style={s.box}>
        <View style={s.boxInner}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput
            style={s.input}
            placeholder={freesoundReady ? 'Search sounds, e.g. "bruh"...' : 'Search title or artist...'}
            placeholderTextColor={t.muted}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={t.accent2}
          />
          {status === 'loading' && <ActivityIndicator size="small" color={t.accent2} style={{ marginRight: 8 }} />}
          {q.length > 0 && <Ionicons name="close-circle" size={18} color={t.muted} onPress={() => setQ('')} />}
        </View>
      </Glass>
      <SectionList
        sections={sections}
        keyExtractor={(x) => x.id}
        // render only what fits on screen first, so switching to this tab shows it right away
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        renderItem={({ item, section }) => <SoundRow sound={item} queue={section.data} />}
        renderSectionHeader={({ section }) =>
          section.key === 'online' ? (
            <View>
              <View style={s.sectionHead}>
                <Ionicons name="globe-outline" size={16} color={t.accent2} />
                <Text style={s.sectionTitle}>{section.title}</Text>
              </View>
              {status === 'loading' && (
                <View style={s.loading}>
                  <ActivityIndicator color={t.accent2} />
                  <Text style={s.loadingText}>Searching Freesound for "{q.trim()}"...</Text>
                </View>
              )}
              {onlineNote && <Text style={s.note}>{onlineNote}</Text>}
            </View>
          ) : null
        }
        renderSectionFooter={({ section }) =>
          section.key === 'mine' && needle && !list.length ? <Text style={s.note}>Nothing in your library matches</Text> : null
        }
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: bottom }}
        ListEmptyComponent={<Text style={s.empty}>No sounds found</Text>}
        ListFooterComponent={
          needle && !freesoundReady ? (
            <Text style={s.note}>Online search is off: set EXPO_PUBLIC_FREESOUND_KEY in .env and restart with "npx expo start -c".</Text>
          ) : needle && online.length ? (
            <Text style={s.credit}>Sounds from Freesound.org · licensed by their authors</Text>
          ) : null
        }
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space.md, marginBottom: space.sm },
  sectionTitle: { color: t.text, fontWeight: '800', fontSize: 15, flex: 1 },
  note: { color: t.muted, fontSize: 13, textAlign: 'center', marginVertical: space.md },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: space.lg },
  loadingText: { color: t.muted, fontSize: 13 },
  credit: { color: t.muted, fontSize: 11, textAlign: 'center', marginTop: space.sm },
});
