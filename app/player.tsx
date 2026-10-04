import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../src/theme';
import { usePlayer } from '../src/context/PlayerContext';
import { Backdrop } from '../src/components/Backdrop';
import { LiquidButton } from '../src/components/LiquidButton';
import { SeekBar } from '../src/components/SeekBar';
import { SpeedDialog } from '../src/components/SpeedDialog';
import { Vinyl } from '../src/components/Vinyl';
import { coverOf } from '../src/components/SoundArt';
import { BRAND_TINT } from '../src/components/tints';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { SleepDialog, useSleepLeft } from '../src/components/SleepDialog';
import { PlayerMenu } from '../src/components/PlayerMenu';
import { useFavorites } from '../src/context/FavoritesContext';
import { shareSound } from '../src/lib/shareSound';

const CATEGORY: Record<string, string> = { meme: 'Meme', music: 'Music', trending: 'Trending', local: 'My Sounds' };
const tick = () => Haptics.selectionAsync().catch(() => {});

// Full-screen player: spinning record with the cover art, title / artist, timeline and controls.
export default function Player() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { current, playing, toggle, rate, setRate, mode, setMode, canSkip, next, prev } = usePlayer();
  const { isFav, toggleFav } = useFavorites();
  const sleepLeft = useSleepLeft();
  const [speedOpen, setSpeedOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // iOS can't show a second popup while the menu's is still fading out, so wait for it there.
  const fromMenu = (fn: () => void) => {
    setMenuOpen(false);
    setTimeout(fn, Platform.OS === 'ios' ? 350 : 0);
  };
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState(false);

  const onShare = async () => {
    if (!current || sharing) return;
    tick();
    setSharing(true);
    try {
      await shareSound(current);
    } catch (e) {
      console.warn('[share] failed', e);
      setShareError(true);
    } finally {
      setSharing(false);
    }
  };

  // Swipe down anywhere on the screen to close it. The timeline / speed slider claim their own
  // touches first, so dragging those never closes the player.
  const close = useRef(() => {});
  close.current = () => router.back();
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && g.dy > Math.abs(g.dx) * 1.6,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.7) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          close.current();
        }
      },
    })
  ).current;

  // Nothing loaded (e.g. the song was just deleted): there is nothing to show.
  useEffect(() => {
    if (!current) router.back();
  }, [current]);
  if (!current) return null;

  const cover = coverOf(current);
  const disc = Math.min(width - 56, height * 0.38, 340);
  // cover art spans the full content width (lined up with the title and controls); the height cap
  // keeps the controls on screen on short phones
  const art = Math.min(width - space.xl * 2, height * 0.5);
  const artist = current.artist || CATEGORY[current.category] || 'Soundly';
  const on = (active: boolean) => (active ? '#fff' : t.btnText);
  const faved = isFav(current.id);

  return (
    <Backdrop>
      {cover && (
        <>
          <Image source={{ uri: cover }} blurRadius={45} resizeMode="cover" style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.4 }] }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.isDark ? 'rgba(5,5,12,0.62)' : 'rgba(238,240,251,0.7)' }]} />
        </>
      )}
      <StatusBar style={t.isDark ? 'light' : 'dark'} hidden={false} animated />
      {/* Explicit insets instead of <SafeAreaView>: inside the full-screen modal it can measure 0 on
          iOS, which pushed the top row under the notch and over the clock / battery. */}
      <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]} {...swipe.panHandlers}>
        <View style={s.top}>
          <LiquidButton compact hitSlop={10} style={s.round} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close player">
            <Ionicons name="chevron-down" size={24} color={t.btnText} />
          </LiquidButton>
          <View style={s.nowWrap} pointerEvents="none">
            <Text style={s.now}>NOW PLAYING</Text>
            {/* settings tucked in the menu still show here while they are changed from normal */}
            {(rate !== 1 || sleepLeft) && (
              <Text style={s.note}>
                {rate !== 1 && `${rate}x`}
                {rate !== 1 && sleepLeft && '   ·   '}
                {sleepLeft && <><Ionicons name="moon" size={10} color={t.accent2} />{`  ${sleepLeft}`}</>}
              </Text>
            )}
          </View>
          <LiquidButton compact hitSlop={10} style={s.round} onPress={() => { tick(); setMenuOpen(true); }} accessibilityRole="button" accessibilityLabel="More options">
            <Ionicons name="ellipsis-vertical" size={20} color={t.btnText} />
          </LiquidButton>
        </View>

        <View style={s.discWrap}>
          {cover ? <AlbumCover uri={cover} playing={playing} size={art} /> : <Vinyl sound={current} playing={playing} size={disc} />}
        </View>

        <View style={s.info}>
          <Text style={s.title} numberOfLines={2}>{current.title}</Text>
          <Text style={s.artist} numberOfLines={1}>{artist}</Text>
          {!!current.album && <Text style={s.album} numberOfLines={1}>{current.album}</Text>}
          {!!current.credit && <Text style={s.album} numberOfLines={1}>{current.credit}</Text>}
        </View>

        <View style={s.seek}>
          <SeekBar />
        </View>

        <View style={s.controls}>
          <LiquidButton
            compact
            hitSlop={8}
            tint={mode.shuffle ? BRAND_TINT : undefined}
            style={s.small}
            onPress={() => { tick(); setMode({ shuffle: !mode.shuffle }); }}
            accessibilityRole="button"
            accessibilityState={{ selected: mode.shuffle }}
            accessibilityLabel={mode.shuffle ? 'Shuffle on' : 'Shuffle off'}
          >
            <Ionicons name="shuffle" size={20} color={on(mode.shuffle)} />
          </LiquidButton>

          <LiquidButton compact hitSlop={8} style={s.skip} onPress={() => { tick(); prev(); }} accessibilityRole="button" accessibilityLabel="Previous song">
            <Ionicons name="play-skip-back" size={22} color={t.btnText} />
          </LiquidButton>

          <LiquidButton tint={BRAND_TINT} style={s.play} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); toggle(); }} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <Ionicons name={playing ? 'pause' : 'play'} size={32} color="#fff" style={{ marginLeft: playing ? 0 : 4 }} />
          </LiquidButton>

          <LiquidButton compact hitSlop={8} disabled={!canSkip} style={s.skip} onPress={() => { tick(); next(); }} accessibilityRole="button" accessibilityLabel="Next song">
            <Ionicons name="play-skip-forward" size={22} color={t.btnText} />
          </LiquidButton>

          <LiquidButton
            compact
            hitSlop={8}
            tint={mode.loop ? BRAND_TINT : undefined}
            style={s.small}
            onPress={() => { tick(); setMode({ loop: !mode.loop }); }}
            accessibilityRole="button"
            accessibilityState={{ selected: mode.loop }}
            accessibilityLabel={mode.loop ? 'Loop this song: on' : 'Loop this song: off'}
          >
            <Ionicons name="repeat" size={20} color={on(mode.loop)} />
            {mode.loop && <Text style={s.one}>1</Text>}
          </LiquidButton>
        </View>
      </View>

      <PlayerMenu
        visible={menuOpen}
        top={insets.top + space.sm + 50}
        onClose={() => setMenuOpen(false)}
        items={[
          // toggles keep the menu open so the new state is visible; the others open something else
          { key: 'fav', icon: faved ? 'heart' : 'heart-outline', label: faved ? 'Remove from favorites' : 'Add to favorites', active: faved, onPress: () => { tick(); toggleFav(current); } },
          { key: 'speed', icon: 'speedometer-outline', label: 'Playback speed', value: `${rate}x`, active: rate !== 1, onPress: () => fromMenu(() => setSpeedOpen(true)) },
          { key: 'auto', icon: 'infinite', label: 'Autoplay', value: mode.autoplay ? 'On' : 'Off', active: mode.autoplay, onPress: () => { tick(); setMode({ autoplay: !mode.autoplay }); } },
          { key: 'sleep', icon: 'moon', label: 'Sleep timer', value: sleepLeft ?? 'Off', active: !!sleepLeft, onPress: () => fromMenu(() => setSleepOpen(true)) },
          { key: 'share', icon: 'share-outline', label: 'Share', busy: sharing, onPress: () => fromMenu(onShare) },
        ]}
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
      <SleepDialog visible={sleepOpen} onClose={() => setSleepOpen(false)} />
      <SpeedDialog visible={speedOpen} rate={rate} onChange={(r) => setRate(r, false)} onCommit={(r) => setRate(r, true)} onClose={() => setSpeedOpen(false)} />
    </Backdrop>
  );
}

// Songs with cover art show the art itself, standing still (a spinning photo is dizzying). It
// eases a little smaller while paused so play / pause still reads at a glance.
function AlbumCover({ uri, playing, size }: { uri: string; playing: boolean; size: number }) {
  const scale = useRef(new Animated.Value(playing ? 1 : 0.88)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: playing ? 1 : 0.88, useNativeDriver: true, damping: 16, stiffness: 160 }).start();
  }, [playing]);
  const radius = size * 0.08;
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        transform: [{ scale }],
        boxShadow: playing ? '0 22 44 rgba(0,0,0,0.5)' : '0 12 28 rgba(0,0,0,0.4)',
      }}
    >
      <Image source={{ uri }} resizeMode="cover" style={{ width: size, height: size, borderRadius: radius }} />
    </Animated.View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: space.xl },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm },
    round: { width: 44, height: 44 },
    nowWrap: { position: 'absolute', left: 0, right: 0, top: space.sm, bottom: 0, alignItems: 'center', justifyContent: 'center' },
    now: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: t.muted },
    note: { fontSize: 11, fontWeight: '700', color: t.accent2, marginTop: 2 },
    discWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    info: { alignItems: 'center', marginBottom: space.md },
    title: { fontSize: 26, fontWeight: '800', color: t.text, textAlign: 'center', letterSpacing: -0.5 },
    artist: { fontSize: 16, fontWeight: '600', color: t.accent2, marginTop: 4, textAlign: 'center' },
    album: { fontSize: 13, color: t.muted, marginTop: 2, textAlign: 'center' },
    seek: { marginBottom: space.sm },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    small: { width: 44, height: 44 },
    skip: { width: 52, height: 52 },
    play: { width: 76, height: 76 },
    one: { position: 'absolute', fontSize: 8, fontWeight: '800', color: '#fff', top: 15 },
  });
