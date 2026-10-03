import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MINI_PLAYER_HEIGHT, Palette, useTheme } from '../theme';
import { usePlayer } from '../context/PlayerContext';
import { Equalizer } from './Equalizer';
import { Glass } from './Glass';
import { LiquidButton } from './LiquidButton';
import { SeekBar } from './SeekBar';
import { SoundArt } from './SoundArt';
import { SpeedDialog } from './SpeedDialog';
import { BRAND_TINT } from './tints';

// The player card lives inside the list, as the playing song's own row. When no such row is on
// screen (other tabs, a filtered list, the song scrolled away) the tab bar shows a slim PlayerPeek
// instead, which opens the full player with a swipe up.
let inlineCount = 0;
const inlineSubs = new Set<() => void>();
const bumpInline = (d: number) => { inlineCount += d; inlineSubs.forEach((f) => f()); };
const subscribeInline = (f: () => void) => { inlineSubs.add(f); return () => { inlineSubs.delete(f); }; };
export const useHasInlinePlayer = () => useSyncExternalStore(subscribeInline, () => inlineCount > 0);


export function MiniPlayer({ inline = false }: { inline?: boolean }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { current, playing, toggle, rate, setRate } = usePlayer();
  const [speedOpen, setSpeedOpen] = useState(false);
  const router = useRouter();
  const shown = useRef(new Animated.Value(0)).current;
  const has = !!current;
  const focused = useIsFocused(); // a screen kept alive in the background must not count as showing the card

  useLayoutEffect(() => {
    if (!inline || !focused || !has) return;
    bumpInline(1);
    return () => bumpInline(-1);
  }, [inline, focused, has]);

  useEffect(() => {
    Animated.spring(shown, { toValue: has ? 1 : 0, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
  }, [has]);

  if (!current) return null;
  return (
    <Animated.View
      style={{
        marginBottom: inline ? 10 : 8,
        opacity: shown,
        transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [inline ? 8 : 24, 0] }) }, { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
      }}
    >
      <Glass radius={26} intensity={60} style={s.wrap}>
        <View style={s.body}>
          <View style={s.row}>
            {/* tapping the song area opens the full-screen player */}
            <Pressable style={({ pressed }) => [s.info, pressed && { opacity: 0.7 }]} onPress={() => router.push('/player')} accessibilityRole="button" accessibilityLabel="Open full player">
              <SoundArt sound={current} size={42} radius={14} style={s.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={s.title} numberOfLines={1}>{current.title}</Text>
                <Text style={s.sub} numberOfLines={1}>{current.artist ? current.artist.toUpperCase() : playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
              </View>
            </Pressable>
            <Equalizer active={playing} />
            <LiquidButton
              compact
              hitSlop={8}
              style={s.speed}
              wrapStyle={{ marginRight: 8 }}
              onPress={() => setSpeedOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Playback speed ${rate}x. Tap to choose`}
            >
              <Text style={[s.speedText, { color: rate === 1 ? t.btnText : t.accent2 }]}>{`${rate}x`}</Text>
            </LiquidButton>
            <LiquidButton compact hitSlop={8} tint={BRAND_TINT} style={s.btn} onPress={toggle} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
              <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" style={{ marginLeft: playing ? 0 : 2 }} />
            </LiquidButton>
          </View>
          <SeekBar />
        </View>
      </Glass>
      <SpeedDialog visible={speedOpen} rate={rate} onChange={(r) => setRate(r, false)} onCommit={(r) => setRate(r, true)} onClose={() => setSpeedOpen(false)} />
    </Animated.View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  wrap: { height: MINI_PLAYER_HEIGHT },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { marginRight: 12 },
  title: { fontSize: 15, fontWeight: '700', color: t.text },
  sub: { fontSize: 10, color: t.accent2, marginTop: 2, letterSpacing: 1.5, fontWeight: '600' },
  speed: { height: 36, minWidth: 50, paddingHorizontal: 8 },
  speedText: { fontSize: 13, fontWeight: '700' },
  btn: { width: 40, height: 40 },
});
