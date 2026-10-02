import { useEffect, useRef } from 'react';
import { Animated, Easing, PanResponder, Platform, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { usePlayer } from '../context/PlayerContext';

// Trapezoid tab that grows out of the top of the tab bar:  /‾‾\
const W = 88; // width where it meets the bar
const T = 52; // width of the flat top
const H = 16; // height
const S = (W - T) / 2; // sideways run of each slanted edge

// Rounded top corners (R = how far the rounding reaches along each edge); the bottom edge is left
// open so the tab melts into the tab bar.
const R = 14;
const LEN = Math.hypot(S, H + 1); // length of a slanted edge
const DX = (S / LEN) * R; // where the rounding starts on the slant
const DY = ((H + 1) / LEN) * R;
const OUTLINE =
  `M0 ${H + 1} L${S - DX} ${DY} Q${S} 0 ${S + R} 0 ` +
  `L${W - S - R} 0 Q${W - S} 0 ${W - S + DX} ${DY} L${W} ${H + 1}`;

// Space the tab takes above the tab bar, for screens that need to leave room for it.
export const PEEK_HEIGHT = H + 6;

// Shown above the tab bar when the playing song has no row on screen. Swipe the tab up (or tap it)
// to open the full player; the full player is closed by swiping down.
export function PlayerPeek() {
  const t = useTheme();
  const router = useRouter();
  const { current } = usePlayer();
  const lift = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  // the arrow nudges up and down, as a hint that the tab can be swiped up
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -2, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const open = useRef(() => { });
  open.current = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    router.push('/player');
  };

  const back = () => Animated.spring(lift, { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 220 }).start();
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => lift.setValue(Math.max(-28, Math.min(0, g.dy * 0.5))), // follows the finger a little
      onPanResponderRelease: (_, g) => {
        const swipedUp = g.dy < -24 || g.vy < -0.4;
        const tapped = Math.abs(g.dy) < 6 && Math.abs(g.dx) < 6;
        back();
        if (swipedUp || tapped) open.current();
      },
      onPanResponderTerminate: back,
    })
  ).current;

  if (!current) return null;
  // same fill the tab bar glass uses, so the tab and the bar read as one piece
  const fill = Platform.OS === 'ios' ? t.glassBlur : t.glassSolid;
  return (
    <Animated.View
      style={[s.wrap, { transform: [{ translateY: lift }] }]}
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Open player. Swipe up"
    >
      <Svg width={W} height={H + 1} viewBox={`0 0 ${W} ${H + 1}`}>
        <Path d={`${OUTLINE} Z`} fill={fill} />
        <Path d={OUTLINE} fill="none" stroke={t.glassStroke} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      <Animated.View pointerEvents="none" style={[s.icon, { transform: [{ translateY: bob }] }]}>
        <Ionicons name="chevron-up" size={17} color={t.text} />
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // -1: overlap the bar by a pixel so there is no seam
  wrap: { alignSelf: 'center', width: W, height: H + 1, marginBottom: -1 },
  icon: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' },
});
