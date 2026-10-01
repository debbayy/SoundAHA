import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GRADIENT, theme } from '../theme';
import { usePlayer } from '../context/PlayerContext';
import { Equalizer } from './Equalizer';

export function MiniPlayer() {
  const { current, playing, toggle, play } = usePlayer();
  if (!current) return null;
  return (
    <LinearGradient colors={['#7C5CFF', '#00E5FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.border}>
      <View style={s.wrap}>
        <Text style={{ fontSize: 26, marginRight: 12 }}>{current.emoji ?? '🔊'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>{current.title}</Text>
          <Text style={s.sub}>{playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
        </View>
        <Equalizer active={playing} />
        <Pressable hitSlop={8} onPress={() => play(current)} style={{ marginRight: 14 }}>
          <Ionicons name="refresh" size={20} color={theme.muted} />
        </Pressable>
        <Pressable hitSlop={8} onPress={toggle}>
          <LinearGradient colors={GRADIENT} style={s.btn}>
            <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" style={{ marginLeft: playing ? 0 : 2 }} />
          </LinearGradient>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  border: { marginHorizontal: 12, marginBottom: 8, borderRadius: 22, padding: 1 },
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card2, borderRadius: 21, padding: 12 },
  title: { fontSize: 15, fontWeight: '700', color: theme.text },
  sub: { fontSize: 10, color: theme.accent2, marginTop: 2, letterSpacing: 1.5 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
