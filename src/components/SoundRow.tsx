import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Palette, useTheme } from '../theme';
import { Sound } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { useLocalSounds } from '../context/LocalSoundsContext';
import { Glass } from './Glass';
import { ConfirmDialog } from './ConfirmDialog';
import { SoundArt } from './SoundArt';
import { LiquidButton } from './LiquidButton';
import { BRAND_TINT } from './tints';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function SoundRow({ sound }: { sound: Sound }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { play, current, playing, stopIf } = usePlayer();
  const { favs, toggleFav } = useAuth();
  const { removeSound } = useLocalSounds();
  const router = useRouter();
  const isCurrent = current?.id === sound.id;
  const active = isCurrent && playing;
  const faved = favs.includes(sound.id);

  const onHeart = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!(await toggleFav(sound.id))) router.push('/login');
  };

  const [confirming, setConfirming] = useState(false);
  const onRemove = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); // buzz = the tap registered
    setConfirming(true);
  };
  const doRemove = () => {
    setConfirming(false);
    stopIf(sound.id);
    removeSound(sound.id);
  };

  // No Pressable nests inside another: the song area, the heart/trash and the play button are
  // separate siblings, so taps (especially the trash) are never swallowed by the card.
  return (
    <View style={s.outer}>
      <ConfirmDialog visible={confirming} title="Remove sound" message={`Remove "${sound.title}" from My Sounds?`} onConfirm={doRemove} onCancel={() => setConfirming(false)} />
      <Glass blur={false} style={isCurrent ? s.on : undefined}>
        <View style={s.row}>
          <Pressable onPress={() => play(sound)} style={({ pressed }) => [s.main, pressed && s.pressed]}>
            <SoundArt sound={sound} size={48} radius={16} style={s.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{sound.title}</Text>
              <Text style={s.sub} numberOfLines={1}>{sound.local ? (sound.artist ? sound.artist.toUpperCase() : 'MY SOUNDS') : `${sound.category.toUpperCase()}  ·  ${fmt(sound.duration)}`}</Text>
            </View>
          </Pressable>
          {sound.local ? (
            <LiquidButton compact hitSlop={6} style={s.icon} wrapStyle={s.gap} onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove sound">
              <Ionicons name="trash-outline" size={18} color={t.btnText} />
            </LiquidButton>
          ) : (
            <LiquidButton compact hitSlop={6} style={s.icon} wrapStyle={s.gap} onPress={onHeart} accessibilityRole="button" accessibilityLabel="Favorite">
              <Ionicons name={faved ? 'heart' : 'heart-outline'} size={19} color={faved ? t.danger : t.btnText} />
            </LiquidButton>
          )}
          <LiquidButton compact hitSlop={6} tint={BRAND_TINT} style={s.play} onPress={() => play(sound)} accessibilityRole="button" accessibilityLabel={active ? 'Pause' : 'Play'}>
            <Ionicons name={active ? 'pause' : 'play'} size={16} color="#fff" style={{ marginLeft: active ? 0 : 2 }} />
          </LiquidButton>
        </View>
      </Glass>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  outer: { marginBottom: 10 },
  on: { borderWidth: 1, borderColor: t.activeRing },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.6 },
  thumb: { marginRight: 12 },
  title: { fontSize: 16, fontWeight: '700', color: t.text },
  sub: { fontSize: 11, color: t.muted, marginTop: 3, letterSpacing: 1, fontWeight: '500' },
  gap: { marginHorizontal: 6 },
  icon: { width: 38, height: 38 },
  play: { width: 40, height: 40 },
});
