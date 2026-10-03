import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Palette, useTheme } from '../theme';
import { Sound } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useAuth } from '../context/AuthContext';
import { normTitle, useLocalSounds } from '../context/LocalSoundsContext';
import { Glass } from './Glass';
import { ConfirmDialog } from './ConfirmDialog';
import { MiniPlayer } from './MiniPlayer';
import { SoundArt } from './SoundArt';
import { LiquidButton } from './LiquidButton';
import { BRAND_TINT } from './tints';
import { shareSound } from '../lib/shareSound';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// `queue` is the list this row belongs to: autoplay / next / shuffle move through it.
export function SoundRow({ sound, queue }: { sound: Sound; queue?: Sound[] }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { play, current, playing, stopIf } = usePlayer();
  const { favs, toggleFav } = useAuth();
  const { removeSound, saveOnline, localSounds } = useLocalSounds();
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

  // Online (Freesound) sounds: save a copy into My Sounds.
  const saved = !!sound.online && localSounds.some((x) => normTitle(x.title) === normTitle(sound.title));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const onSave = async () => {
    if (saved || saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSaving(true);
    try {
      const r = await saveOnline(sound);
      if (!r.added && !r.skipped) setSaveError(true);
    } catch (e) {
      console.warn('[save] failed', e);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // Long-press the song to share it (AirDrop / Bluetooth / chat apps via the system share sheet).
  const [shareError, setShareError] = useState(false);
  const sharing = useRef(false);
  const onLongPress = async () => {
    if (sharing.current) return;
    sharing.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await shareSound(sound);
    } catch (e) {
      console.warn('[share] failed', e);
      setShareError(true);
    } finally {
      sharing.current = false;
    }
  };

  // The playing song's row turns into the player card, in the same spot of the list.
  if (isCurrent) return <MiniPlayer inline />;

  // No Pressable nests inside another: the song area, the heart/trash and the play button are
  // separate siblings, so taps (especially the trash) are never swallowed by the card.
  return (
    <View style={s.outer}>
      <ConfirmDialog visible={confirming} title="Remove sound" message={`Remove "${sound.title}" from My Sounds?`} onConfirm={doRemove} onCancel={() => setConfirming(false)} />
      <ConfirmDialog
        visible={saveError}
        title="Can't save"
        message="This sound couldn't be downloaded. Check your connection and try again."
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setSaveError(false)}
        onCancel={() => setSaveError(false)}
      />
      <ConfirmDialog
        visible={shareError}
        title="Can't share"
        message="This song couldn't be prepared for sharing. Please try again."
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setShareError(false)}
        onCancel={() => setShareError(false)}
      />
      <Glass blur={false} style={isCurrent ? s.on : undefined}>
        <View style={s.row}>
          <Pressable
            onPress={() => play(sound, queue)}
            onLongPress={onLongPress}
            delayLongPress={400}
            accessibilityHint="Long-press to share"
            style={({ pressed }) => [s.main, pressed && s.pressed]}
          >
            <SoundArt sound={sound} size={48} radius={16} style={s.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{sound.title}</Text>
              <Text style={s.sub} numberOfLines={1}>{sound.online ? `${fmt(sound.duration)}  ·  ${sound.credit}` : sound.local ? (sound.artist ? sound.artist.toUpperCase() : 'MY SOUNDS') : `${sound.category.toUpperCase()}  ·  ${fmt(sound.duration)}`}</Text>
            </View>
          </Pressable>
          {sound.online ? (
            <LiquidButton compact hitSlop={6} style={s.icon} wrapStyle={s.gap} disabled={saving} onPress={onSave} accessibilityRole="button" accessibilityLabel={saved ? 'Saved to My Sounds' : 'Save to My Sounds'}>
              {saving ? <ActivityIndicator size="small" color={t.btnText} /> : <Ionicons name={saved ? 'checkmark' : 'download-outline'} size={18} color={saved ? t.accent2 : t.btnText} />}
            </LiquidButton>
          ) : sound.local ? (
            <LiquidButton compact hitSlop={6} style={s.icon} wrapStyle={s.gap} onPress={onRemove} accessibilityRole="button" accessibilityLabel="Remove sound">
              <Ionicons name="trash-outline" size={18} color={t.btnText} />
            </LiquidButton>
          ) : (
            <LiquidButton compact hitSlop={6} style={s.icon} wrapStyle={s.gap} onPress={onHeart} accessibilityRole="button" accessibilityLabel="Favorite">
              <Ionicons name={faved ? 'heart' : 'heart-outline'} size={19} color={faved ? t.danger : t.btnText} />
            </LiquidButton>
          )}
          <LiquidButton compact hitSlop={6} tint={BRAND_TINT} style={s.play} onPress={() => play(sound, queue)} accessibilityRole="button" accessibilityLabel={active ? 'Pause' : 'Play'}>
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
