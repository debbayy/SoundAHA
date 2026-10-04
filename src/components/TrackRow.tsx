import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../theme';
import { Sound } from '../types';
import { SoundArt } from './SoundArt';
import { Equalizer } from './Equalizer';

type Props = {
  sound: Sound;
  onPress: () => void;
  onRemove?: () => void; // shows a × button
  removeLabel?: string;
  current?: boolean; // the loaded song: accent title + equalizer
  playing?: boolean;
};

// Compact song row for editable lists (queue, playlist): tap to play, × to take it out.
export function TrackRow({ sound, onPress, onRemove, removeLabel = 'Remove', current, playing = false }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const sub = sound.artist || sound.album || sound.category.toUpperCase();
  return (
    <View style={[s.row, current && s.now]}>
      <Pressable
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
        style={({ pressed }) => [s.main, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={`Play ${sound.title}`}
      >
        <SoundArt sound={sound} size={44} radius={12} style={s.thumb} />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, current && { color: t.accent2 }]} numberOfLines={1}>{sound.title}</Text>
          <Text style={s.sub} numberOfLines={1}>{sub}</Text>
        </View>
        {current && <Equalizer active={playing} />}
      </Pressable>
      {onRemove && (
        <Pressable
          onPress={() => { Haptics.selectionAsync().catch(() => {}); onRemove(); }}
          hitSlop={10}
          style={s.remove}
          accessibilityRole="button"
          accessibilityLabel={`${removeLabel}: ${sound.title}`}
        >
          <Ionicons name="close" size={20} color={t.muted} />
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    now: { paddingHorizontal: 12, borderRadius: 16, backgroundColor: t.fillStrong },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    thumb: { marginRight: 12 },
    title: { fontSize: 15, fontWeight: '700', color: t.text },
    sub: { fontSize: 12, color: t.muted, marginTop: 2 },
    remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: space.xs },
  });
