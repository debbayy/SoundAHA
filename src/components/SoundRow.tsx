import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../theme';
import { Sound } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function SoundRow({ sound }: { sound: Sound }) {
  const { play, current, playing } = usePlayer();
  const { favs, toggleFav } = useAuth();
  const router = useRouter();
  const active = current?.id === sound.id && playing;
  const faved = favs.includes(sound.id);

  const onHeart = async () => {
    if (!(await toggleFav(sound.id))) router.push('/login');
  };

  return (
    <View style={s.row}>
      <View style={s.thumb}><Text style={{ fontSize: 24 }}>{sound.emoji ?? '🔊'}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{sound.title}</Text>
        <Text style={s.sub}>{sound.category} • {fmt(sound.duration)}</Text>
      </View>
      <Pressable hitSlop={8} onPress={() => play(sound)} style={s.play}>
        <Ionicons name={active ? 'pause' : 'play'} size={18} color="#fff" />
      </Pressable>
      <Pressable hitSlop={8} onPress={onHeart} style={{ marginLeft: 12 }}>
        <Ionicons name={faved ? 'heart' : 'heart-outline'} size={22} color={faved ? '#FF4D6D' : theme.muted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: theme.radius, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  thumb: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 16, fontWeight: '600', color: theme.text },
  sub: { fontSize: 12, color: theme.muted, marginTop: 2, textTransform: 'capitalize' },
  play: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
});
