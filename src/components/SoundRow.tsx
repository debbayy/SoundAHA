import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GRADIENT, theme } from '../theme';
import { Sound } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useLocalSounds } from '../context/LocalSoundsContext';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function SoundRow({ sound }: { sound: Sound }) {
  const { play, current, playing } = usePlayer();
  const { favs, toggleFav } = useAuth();
  const { removeSound } = useLocalSounds();
  const router = useRouter();
  const isCurrent = current?.id === sound.id;
  const active = isCurrent && playing;
  const faved = favs.includes(sound.id);

  const onHeart = async () => {
    if (!(await toggleFav(sound.id))) router.push('/login');
  };

  const onRemove = () =>
    Alert.alert('Remove sound', `Remove "${sound.title}" from My Sounds?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeSound(sound.id) },
    ]);

  return (
    <Pressable onPress={() => play(sound)} style={[s.row, isCurrent && s.rowOn]}>
      <View style={s.thumb}><Text style={{ fontSize: 24 }}>{sound.emoji ?? '🔊'}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{sound.title}</Text>
        <Text style={s.sub}>{sound.local ? 'MY SOUNDS' : `${sound.category.toUpperCase()}  ·  ${fmt(sound.duration)}`}</Text>
      </View>
      {sound.local ? (
        <Pressable hitSlop={10} onPress={onRemove} style={{ marginRight: 12 }} accessibilityLabel="Remove sound">
          <Ionicons name="trash-outline" size={20} color={theme.muted} />
        </Pressable>
      ) : (
        <Pressable hitSlop={10} onPress={onHeart} style={{ marginRight: 12 }}>
          <Ionicons name={faved ? 'heart' : 'heart-outline'} size={20} color={faved ? theme.danger : theme.muted} />
        </Pressable>
      )}
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.play}>
        <Ionicons name={active ? 'pause' : 'play'} size={16} color="#fff" style={{ marginLeft: active ? 0 : 2 }} />
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, borderRadius: theme.radius, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  rowOn: { borderColor: theme.accent, backgroundColor: theme.card2 },
  thumb: { width: 50, height: 50, borderRadius: 16, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: theme.border },
  title: { fontSize: 16, fontWeight: '700', color: theme.text },
  sub: { fontSize: 11, color: theme.muted, marginTop: 3, letterSpacing: 1 },
  play: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
