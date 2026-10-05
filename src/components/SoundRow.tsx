import { memo, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Palette, useTheme } from '../theme';
import { Sound } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useFavorites } from '../context/FavoritesContext';
import { normTitle, useLocalSounds } from '../context/LocalSoundsContext';
import { Glass } from './Glass';
import { ConfirmDialog } from './ConfirmDialog';
import { MiniPlayer } from './MiniPlayer';
import { SoundArt } from './SoundArt';
import { LiquidButton } from './LiquidButton';
import { BRAND_TINT } from './tints';
import { openSoundActions } from './SoundActions';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const RADIUS = 22; // same as the row's glass
const SWIPE_AT = 80; // drag this far and let go to favorite / delete
const MAX_DRAG = 140;
const PANEL_GAP = 8; // the colored panel trails the row with a small gap

// `queue` is the list this row belongs to: autoplay / next / shuffle move through it.
// Swipe right: favorite (or unfavorite). Swipe left: delete (imported songs only).
function SoundRowView({ sound, queue }: { sound: Sound; queue?: Sound[] }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { play, current, playing, stopIf } = usePlayer();
  const { isFav, toggleFav } = useFavorites();
  const { removeSound, saveOnline, localSounds } = useLocalSounds();
  const isCurrent = current?.id === sound.id;
  const active = isCurrent && playing;
  const faved = isFav(sound.id);
  const canDelete = !!sound.local;

  const [confirming, setConfirming] = useState(false);
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

  // Long-press the song for more: play next, add to queue / a playlist, share.
  const onLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    openSoundActions(sound);
  };

  // ---- swipe -------------------------------------------------------------------------------
  const x = useRef(new Animated.Value(0)).current; // how far the row is dragged (+ right, - left)
  const width = useRef(new Animated.Value(400)).current; // row width, so the panels can trail its edges
  const armed = useRef(false); // past SWIPE_AT: letting go will act
  const act = useRef({ fav: () => {}, del: () => {}, canDelete });
  act.current = {
    fav: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toggleFav(sound);
    },
    del: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setConfirming(true);
    },
    canDelete,
  };
  const settle = () => Animated.spring(x, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 240 }).start();
  const pan = useRef(
    PanResponder.create({
      // only clearly sideways drags: vertical ones still scroll the list, taps still play
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { armed.current = false; },
      onPanResponderMove: (_, g) => {
        // nothing to delete: the row only gives a little to the left
        const dx = g.dx < 0 && !act.current.canDelete ? Math.max(-20, g.dx * 0.15) : Math.max(-MAX_DRAG, Math.min(MAX_DRAG, g.dx));
        x.setValue(dx);
        const over = Math.abs(dx) >= SWIPE_AT;
        if (over !== armed.current) {
          armed.current = over;
          Haptics.selectionAsync().catch(() => {}); // tick when crossing the line, either way
        }
      },
      onPanResponderRelease: (_, g) => {
        settle();
        if (g.dx >= SWIPE_AT) act.current.fav();
        else if (g.dx <= -SWIPE_AT && act.current.canDelete) act.current.del();
      },
      onPanResponderTerminate: settle,
    })
  ).current;
  const onLayout = (e: LayoutChangeEvent) => width.setValue(e.nativeEvent.layout.width);
  const iconScale = (sign: 1 | -1) =>
    x.interpolate({ inputRange: sign > 0 ? [0, SWIPE_AT] : [-SWIPE_AT, 0], outputRange: sign > 0 ? [0.6, 1.15] : [1.15, 0.6], extrapolate: 'clamp' });

  // The playing song's row turns into the player card, in the same spot of the list.
  if (isCurrent) return <MiniPlayer inline />;

  const sub = sound.online
    ? `${fmt(sound.duration)}  ·  ${sound.credit}`
    : sound.local
      ? (sound.artist ? sound.artist.toUpperCase() : 'MY SOUNDS')
      : `${sound.category.toUpperCase()}  ·  ${fmt(sound.duration)}`;

  return (
    <View
      style={s.outer}
      onLayout={onLayout}
      accessibilityActions={[
        { name: 'favorite', label: faved ? 'Remove from favorites' : 'Add to favorites' },
        ...(canDelete ? [{ name: 'delete', label: 'Remove sound' }] : []),
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'favorite') act.current.fav();
        if (e.nativeEvent.actionName === 'delete') act.current.del();
      }}
    >
      {/* mounted only while open: a hidden Modal per row adds up in long lists on slow phones */}
      {confirming && (
        <ConfirmDialog visible title="Remove sound" message={`Remove "${sound.title}" from My Sounds?`} onConfirm={doRemove} onCancel={() => setConfirming(false)} />
      )}
      {saveError && (
        <ConfirmDialog
          visible
          title="Can't save"
          message="This sound couldn't be downloaded. Check your connection and try again."
          confirmLabel="OK"
          hideCancel
          onConfirm={() => setSaveError(false)}
          onCancel={() => setSaveError(false)}
        />
      )}

      {/* Colored panels sit just outside the row and slide in with it, filling only the uncovered
          space (the row's glass is see-through, so they must never be under it). */}
      <View pointerEvents="none" style={s.panels}>
        <Animated.View style={[s.panel, s.favPanel, { transform: [{ translateX: Animated.add(x, Animated.multiply(width, -1)) }, { translateX: -PANEL_GAP }] }]}>
          <Animated.View style={{ transform: [{ scale: iconScale(1) }] }}>
            <Ionicons name={faved ? 'heart-dislike' : 'heart'} size={24} color="#fff" />
          </Animated.View>
        </Animated.View>
        {canDelete && (
          <Animated.View style={[s.panel, s.delPanel, { transform: [{ translateX: Animated.add(x, width) }, { translateX: PANEL_GAP }] }]}>
            <Animated.View style={{ transform: [{ scale: iconScale(-1) }] }}>
              <Ionicons name="trash" size={22} color="#fff" />
            </Animated.View>
          </Animated.View>
        )}
      </View>

      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        <Glass blur={false} radius={RADIUS}>
          <View style={s.row}>
            <Pressable
              onPress={() => play(sound, queue)}
              onLongPress={onLongPress}
              delayLongPress={400}
              accessibilityHint="Swipe right to favorite. Long-press for more options"
              style={({ pressed }) => [s.main, pressed && s.pressed]}
            >
              <SoundArt sound={sound} size={48} radius={16} style={s.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{sound.title}</Text>
                <View style={s.subRow}>
                  {faved && <Ionicons name="heart" size={11} color={t.success} style={s.favMark} accessibilityLabel="Favorite" />}
                  <Text style={s.sub} numberOfLines={1}>{sub}</Text>
                </View>
              </View>
            </Pressable>
            {sound.online && (
              <LiquidButton compact hitSlop={6} style={s.icon} wrapStyle={s.gap} disabled={saving} onPress={onSave} accessibilityRole="button" accessibilityLabel={saved ? 'Saved to My Sounds' : 'Save to My Sounds'}>
                {saving ? <ActivityIndicator size="small" color={t.btnText} /> : <Ionicons name={saved ? 'checkmark' : 'download-outline'} size={18} color={saved ? t.accent2 : t.btnText} />}
              </LiquidButton>
            )}
            <LiquidButton compact hitSlop={6} tint={BRAND_TINT} style={s.play} wrapStyle={s.playWrap} onPress={() => play(sound, queue)} accessibilityRole="button" accessibilityLabel={active ? 'Pause' : 'Play'}>
              <Ionicons name={active ? 'pause' : 'play'} size={16} color="#fff" style={{ marginLeft: active ? 0 : 2 }} />
            </LiquidButton>
          </View>
        </Glass>
      </Animated.View>
    </View>
  );
}

// Memoized: a list re-rendering (a dialog opening, a filter changing) leaves unchanged rows alone.
export const SoundRow = memo(SoundRowView);

const makeStyles = (t: Palette) => StyleSheet.create({
  outer: { marginBottom: 10 },
  panels: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden', borderRadius: RADIUS },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: RADIUS, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 },
  favPanel: { backgroundColor: t.success, justifyContent: 'flex-end' }, // icon next to the row's left edge
  delPanel: { backgroundColor: t.destroy, justifyContent: 'flex-start' }, // icon next to the row's right edge
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pressed: { opacity: 0.6 },
  thumb: { marginRight: 12 },
  title: { fontSize: 16, fontWeight: '700', color: t.text },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  favMark: { marginRight: 5 },
  sub: { flexShrink: 1, fontSize: 11, color: t.muted, letterSpacing: 1, fontWeight: '500' },
  gap: { marginHorizontal: 6 },
  icon: { width: 38, height: 38 },
  playWrap: { marginLeft: 6 },
  play: { width: 40, height: 40 },
});
