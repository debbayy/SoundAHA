import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GRADIENT, Palette, space, useTheme } from '../theme';
import { MAX_RATE, MIN_RATE, RATE_STEP } from '../context/PlayerContext';
import { DialogFrame } from './DialogFrame';

type Props = {
  visible: boolean;
  rate: number;
  onChange: (rate: number) => void; // while dragging: apply live
  onCommit: (rate: number) => void; // finger lifted: save
  onClose: () => void;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const toRate = (ratio: number) => {
  const raw = MIN_RATE + clamp01(ratio) * (MAX_RATE - MIN_RATE);
  return Math.round(Math.round(raw / RATE_STEP) * RATE_STEP * 100) / 100;
};
const toRatio = (rate: number) => clamp01((rate - MIN_RATE) / (MAX_RATE - MIN_RATE));
const label = (r: number) => `${r}x`;
const hint = (r: number) => (r < 1 ? 'Slow' : r > 1 ? 'Fast' : 'Normal');

const TICKS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const MARKS = [0.25, 0.5, 1, 1.5, 2]; // labelled ticks

// Speed picker like YouTube's: a left-to-right slider from slow to fast. Dragging changes the
// speed live; the song keeps playing so you hear it right away.
export function SpeedDialog({ visible, rate, onChange, onCommit, onClose }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [live, setLive] = useState(rate);
  const [dragging, setDragging] = useState(false);
  const widthRef = useRef(1);
  const startX = useRef(0);
  const lastRate = useRef(rate);
  const cb = useRef({ onChange, onCommit });
  cb.current = { onChange, onCommit };
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) { setLive(rate); lastRate.current = rate; }
  }, [visible]);

  useEffect(() => {
    Animated.spring(grow, { toValue: dragging ? 1 : 0, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  }, [dragging]);

  const apply = (ratio: number, commit: boolean) => {
    const r = toRate(ratio);
    if (r !== lastRate.current) {
      lastRate.current = r;
      Haptics.selectionAsync().catch(() => { });
      setLive(r);
      cb.current.onChange(r);
    }
    if (commit) cb.current.onCommit(r);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          startX.current = e.nativeEvent.locationX;
          setDragging(true);
          apply(startX.current / widthRef.current, false);
        },
        onPanResponderMove: (_, g) => apply((startX.current + g.dx) / widthRef.current, false),
        onPanResponderRelease: (_, g) => {
          apply((startX.current + g.dx) / widthRef.current, true);
          setDragging(false);
        },
        onPanResponderTerminate: () => setDragging(false),
      }),
    []
  );

  const ratio = toRatio(live);
  const reset = () => {
    Haptics.selectionAsync().catch(() => { });
    lastRate.current = 1;
    setLive(1);
    cb.current.onChange(1);
    cb.current.onCommit(1);
  };

  return (
    <DialogFrame visible={visible} onClose={onClose}>
            <View style={s.card}>
              <Text style={s.title}>Playback speed</Text>
              <View
                style={s.hit}
                onLayout={(e: LayoutChangeEvent) => { widthRef.current = Math.max(1, e.nativeEvent.layout.width); }}
                {...pan.panHandlers}
              >
                {/* children ignore touches so locationX is relative to the whole slider */}
                <View pointerEvents="none" style={s.track}>
                  <View style={[s.fill, { width: `${ratio * 100}%` }]}>
                    <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  </View>
                </View>
                {TICKS.map((tk) => (
                  <View key={tk} pointerEvents="none" style={[s.tick, { left: `${toRatio(tk) * 100}%`, opacity: tk <= live ? 0.0 : 0.5 }]} />
                ))}
                <Animated.View
                  pointerEvents="none"
                  style={[s.thumb, { left: `${ratio * 100}%`, transform: [{ translateX: -13 }, { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }] }]}
                />
              </View>

              <View style={s.marks} pointerEvents="none">
                {MARKS.map((m) => (
                  <Text key={m} style={[s.mark, { left: `${toRatio(m) * 100}%` }]}>{label(m)}</Text>
                ))}
              </View>

              <Pressable onPress={reset} hitSlop={10} disabled={live === 1} style={[s.reset, live === 1 && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Reset speed to normal">
                <Text style={s.resetText}>Reset to Normal</Text>
              </Pressable>
            </View>
    </DialogFrame>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    card: { paddingVertical: space.lg, paddingHorizontal: space.xl },
    title: { fontSize: 14, fontWeight: '700', color: t.muted, textAlign: 'center', letterSpacing: 1.2, textTransform: 'uppercase' },
    value: { fontSize: 44, fontWeight: '800', color: t.text, textAlign: 'center', marginTop: space.sm, letterSpacing: -1 },
    hint: { fontSize: 13, color: t.muted, textAlign: 'center', marginBottom: space.md },
    hit: { height: 44, justifyContent: 'center' },
    track: { height: 6, borderRadius: 3, backgroundColor: t.fillStrong, overflow: 'hidden' },
    fill: { height: '100%', overflow: 'hidden' },
    tick: { position: 'absolute', top: 15, width: 2, height: 14, marginLeft: -1, borderRadius: 1, backgroundColor: t.muted },
    thumb: {
      position: 'absolute',
      top: 9,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#fff',
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: 'rgba(0,0,0,0.12)',
      boxShadow: '0 3 8 rgba(0,0,0,0.35)',
    },
    marks: { height: 18, marginTop: 2 },
    mark: { position: 'absolute', width: 44, marginLeft: -22, textAlign: 'center', fontSize: 11, fontWeight: '600', color: t.muted },
    reset: { alignSelf: 'center', marginTop: space.md, paddingVertical: 6, paddingHorizontal: 12 },
    resetText: { fontSize: 13, fontWeight: '700', color: t.accent2 },
  });
