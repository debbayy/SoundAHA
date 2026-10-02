import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MINI_PLAYER_HEIGHT, Palette, useTheme } from '../theme';
import { usePlayer } from '../context/PlayerContext';
import { Equalizer } from './Equalizer';
import { Glass } from './Glass';
import { LiquidButton } from './LiquidButton';
import { SeekBar } from './SeekBar';
import { BRAND_TINT } from './tints';

export function MiniPlayer() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { current, playing, toggle, play } = usePlayer();
  const shown = useRef(new Animated.Value(0)).current;
  const has = !!current;

  useEffect(() => {
    Animated.spring(shown, { toValue: has ? 1 : 0, useNativeDriver: true, damping: 16, stiffness: 180 }).start();
  }, [has]);

  if (!current) return null;
  return (
    <Animated.View
      style={{
        marginBottom: 8,
        opacity: shown,
        transform: [{ translateY: shown.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: shown.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
      }}
    >
      <Glass radius={26} intensity={60} style={s.wrap}>
        <View style={s.body}>
          <View style={s.row}>
            <View style={s.thumb}><Text style={{ fontSize: 22 }}>{current.emoji ?? '🔊'}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{current.title}</Text>
              <Text style={s.sub}>{playing ? 'NOW PLAYING' : 'PAUSED'}</Text>
            </View>
            <Equalizer active={playing} />
            <LiquidButton compact hitSlop={8} style={s.ghost} wrapStyle={{ marginRight: 8 }} onPress={() => play(current)} accessibilityRole="button" accessibilityLabel="Replay">
              <Ionicons name="refresh" size={18} color={t.btnText} />
            </LiquidButton>
            <LiquidButton compact hitSlop={8} tint={BRAND_TINT} style={s.btn} onPress={toggle} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
              <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" style={{ marginLeft: playing ? 0 : 2 }} />
            </LiquidButton>
          </View>
          <SeekBar />
        </View>
      </Glass>
    </Animated.View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  wrap: { height: MINI_PLAYER_HEIGHT },
  body: { flex: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 42, height: 42, borderRadius: 14, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 15, fontWeight: '700', color: t.text },
  sub: { fontSize: 10, color: t.accent2, marginTop: 2, letterSpacing: 1.5, fontWeight: '600' },
  ghost: { width: 36, height: 36 },
  btn: { width: 40, height: 40 },
});
