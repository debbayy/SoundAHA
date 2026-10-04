import { useEffect, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../src/theme';
import { usePlayer } from '../src/context/PlayerContext';
import { Backdrop } from '../src/components/Backdrop';
import { LiquidButton } from '../src/components/LiquidButton';
import { TrackRow } from '../src/components/TrackRow';
import { upNext } from '../src/lib/queue';

// What plays now and next. Tap a song to jump to it, × to take it out of the queue.
export default function Queue() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { current, playing, queue, play, removeFromQueue, mode } = usePlayer();
  const next = useMemo(() => upNext(queue, current?.id), [queue, current?.id]);

  useEffect(() => {
    if (!current) router.back();
  }, [current]);
  if (!current) return null;

  return (
    <Backdrop>
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.top}>
          <LiquidButton compact hitSlop={10} style={s.round} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close queue">
            <Ionicons name="chevron-down" size={24} color={t.btnText} />
          </LiquidButton>
          <Text style={s.h1}>Queue</Text>
          <View style={s.round} />
        </View>

        <FlatList
          data={next}
          keyExtractor={(x) => x.id}
          initialNumToRender={10}
          windowSize={7}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.lg }}
          ListHeaderComponent={
            <View>
              <Text style={s.label}>NOW PLAYING</Text>
              <TrackRow sound={current} current playing={playing} onPress={() => router.back()} />
              <Text style={[s.label, { marginTop: space.lg }]}>
                {mode.shuffle ? 'UP NEXT · SHUFFLE ON (RANDOM ORDER)' : `UP NEXT · ${next.length}`}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TrackRow sound={item} onPress={() => play(item)} onRemove={() => removeFromQueue(item.id)} removeLabel="Remove from queue" />
          )}
          ListEmptyComponent={
            <Text style={s.empty}>Nothing up next. Long-press a song and choose "Play next" or "Add to queue".</Text>
          }
        />
      </View>
    </Backdrop>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1 },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm },
    round: { width: 44, height: 44 },
    h1: { fontSize: 18, fontWeight: '800', color: t.text },
    label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: t.muted, marginBottom: space.sm },
    empty: { color: t.muted, textAlign: 'center', marginTop: space.xl, paddingHorizontal: space.lg, lineHeight: 20 },
  });
