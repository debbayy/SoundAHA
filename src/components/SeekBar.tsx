import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GRADIENT, Palette, useTheme } from '../theme';
import { usePlayer, useProgress } from '../context/PlayerContext';

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Timeline: drag (or tap) anywhere on the bar to jump to that moment of the song.
export function SeekBar() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { seekTo } = usePlayer();
  const { position, duration } = useProgress();
  const [drag, setDrag] = useState<number | null>(null); // 0..1 while the finger is down
  const widthRef = useRef(1);
  const startX = useRef(0);
  const durRef = useRef(duration);
  durRef.current = duration;
  const seekRef = useRef(seekTo);
  seekRef.current = seekTo;
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(grow, { toValue: drag === null ? 0 : 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  }, [drag === null]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => durRef.current > 0,
        onMoveShouldSetPanResponder: () => durRef.current > 0,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          startX.current = e.nativeEvent.locationX;
          Haptics.selectionAsync().catch(() => {});
          setDrag(clamp01(startX.current / widthRef.current));
        },
        onPanResponderMove: (_, g) => setDrag(clamp01((startX.current + g.dx) / widthRef.current)),
        onPanResponderRelease: (_, g) => {
          const ratio = clamp01((startX.current + g.dx) / widthRef.current);
          seekRef.current(ratio * durRef.current);
          setDrag(null);
        },
        onPanResponderTerminate: () => setDrag(null),
      }),
    []
  );

  const ratio = drag ?? (duration > 0 ? clamp01(position / duration) : 0);
  const shown = drag !== null ? drag * duration : position;

  return (
    <View style={s.row}>
      <Text style={s.time}>{fmt(shown)}</Text>
      <View
        style={s.hit}
        onLayout={(e: LayoutChangeEvent) => { widthRef.current = Math.max(1, e.nativeEvent.layout.width); }}
        {...pan.panHandlers}
      >
        {/* children ignore touches so locationX is always relative to the whole bar */}
        <View pointerEvents="none" style={s.track}>
          <View style={[s.fill, { width: `${ratio * 100}%` }]}>
            <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </View>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[s.thumb, { left: `${ratio * 100}%`, transform: [{ translateX: -8 }, { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] }]}
        />
      </View>
      <Text style={[s.time, { textAlign: 'right' }]}>{fmt(duration)}</Text>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    time: { width: 36, fontSize: 11, fontWeight: '600', color: t.muted, fontVariant: ['tabular-nums'] },
    hit: { flex: 1, height: 30, justifyContent: 'center' },
    track: { height: 5, borderRadius: 3, backgroundColor: t.fillStrong, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3, overflow: 'hidden' },
    thumb: {
      position: 'absolute',
      top: 7,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#fff',
      boxShadow: '0 2 6 rgba(0,0,0,0.35)',
    },
  });
