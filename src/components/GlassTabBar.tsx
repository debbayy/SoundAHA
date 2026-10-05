import { ComponentProps, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Palette, TAB_BAR_HEIGHT, useTheme } from '../theme';
import { Glass } from './Glass';
import { usePlayer } from '../context/PlayerContext';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  search: ['search', 'search-outline'],
  favorites: ['heart', 'heart-outline'],
  profile: ['person', 'person-outline'],
};
// expo-router ships its own copy of React Navigation and doesn't export the tab bar's props type
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const PAD = 6;
// Gap between our bar and Android's own navigation bar (buttons or gesture line), so the two don't
// sit edge to edge. Old phones without edge-to-edge report a 0 inset; they still get the gap.
const ANDROID_LIFT = 12;

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { current } = usePlayer();
  const router = useRouter();
  const s = useMemo(() => makeStyles(t), [t]);
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const itemW = w ? (w - PAD * 2) / state.routes.length : 0;

  useEffect(() => {
    if (!itemW) return;
    Animated.spring(x, { toValue: state.index * itemW, useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.8 }).start();
  }, [state.index, itemW]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  // Swipe up on the bar to open the full player (while a song is loaded). There is no button for it:
  // the swipe takes over from a tab's tap only once the finger clearly moves up, so taps still switch tabs.
  // The bar itself stays put.
  const hasSong = useRef(false);
  hasSong.current = !!current;
  const openPlayer = useRef(() => {});
  openPlayer.current = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/player');
  };
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => hasSong.current && g.dy < -8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30 || g.vy < -0.5) openPlayer.current();
      },
    })
  ).current;

  return (
    <View pointerEvents="box-none" style={[s.dock, { paddingBottom: Platform.OS === 'android' ? insets.bottom + ANDROID_LIFT : Math.max(insets.bottom, 10) }]}>
      {/* soft edge: the list fades out just before the bar instead of being cut off */}
      <LinearGradient pointerEvents="none" colors={[t.bgFade0, t.bgFade1]} style={s.fade} />
      <View
        {...swipe.panHandlers}
        accessibilityActions={current ? [{ name: 'magicTap', label: 'Open player' }] : undefined}
        onAccessibilityAction={() => openPlayer.current()} // screen readers can't swipe
      >
        <Glass radius={TAB_BAR_HEIGHT / 2} intensity={55} style={s.bar}>
          <View style={s.inner} onLayout={onLayout}>
            {itemW > 0 && (
              <Animated.View style={[s.pill, { width: itemW, transform: [{ translateX: x }] }]} />
            )}
            {state.routes.map((route, i) => {
              const focused = state.index === i;
              const label = descriptors[route.key].options.title ?? route.name;
              const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
              const press = () => {
                const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !ev.defaultPrevented) {
                  Haptics.selectionAsync().catch(() => { });
                  navigation.navigate(route.name, route.params);
                }
              };
              return (
                <Pressable key={route.key} onPress={press} style={s.item} accessibilityRole="button" accessibilityState={{ selected: focused }} accessibilityLabel={label}>
                  <Ionicons name={focused ? on : off} size={22} color={focused ? t.text : t.muted} />
                </Pressable>
              );
            })}
          </View>
        </Glass>
      </View>
    </View>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  // In the normal layout flow (not absolute): the screen above ends where this starts, so lists never
  // slide underneath the bar.
  dock: { paddingHorizontal: 16, paddingTop: 8 },
  fade: { position: 'absolute', left: 0, right: 0, top: -30, height: 38 },
  bar: { height: TAB_BAR_HEIGHT },
  inner: { flex: 1, flexDirection: 'row', padding: PAD },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.2 },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: (TAB_BAR_HEIGHT - PAD * 2) / 2,
    backgroundColor: t.fillStrong,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    borderColor: t.pillStroke,
  },
});
