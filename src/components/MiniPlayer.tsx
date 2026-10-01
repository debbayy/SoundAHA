import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { usePlayer } from '../context/PlayerContext';

export function MiniPlayer() {
  const { current, playing, toggle, play } = usePlayer();
  if (!current) return null;
  return (
    <View style={s.wrap}>
      <Text style={{ fontSize: 24, marginRight: 12 }}>{current.emoji ?? '🔊'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{current.title}</Text>
        <Text style={s.sub}>{current.category}</Text>
      </View>
      <Pressable hitSlop={8} onPress={() => play(current)} style={{ marginRight: 16 }}>
        <Ionicons name="refresh" size={20} color={theme.muted} />
      </Pressable>
      <Pressable hitSlop={8} onPress={toggle}>
        <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={36} color={theme.accent} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, marginHorizontal: 12, marginBottom: 6, padding: 12, borderRadius: theme.radius, borderWidth: 1, borderColor: theme.border },
  title: { fontSize: 15, fontWeight: '600', color: theme.text },
  sub: { fontSize: 12, color: theme.muted, textTransform: 'capitalize' },
});
