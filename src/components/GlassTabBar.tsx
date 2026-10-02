import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Palette, TAB_BAR_HEIGHT, useTheme } from '../theme';
import { Glass } from './Glass';
import { MiniPlayer } from './MiniPlayer';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  search: ['search', 'search-outline'],
  favorites: ['heart', 'heart-outline'],
  profile: ['person', 'person-outline'],
};
const PAD = 6;

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const itemW = w ? (w - PAD * 2) / state.routes.length : 0;

  useEffect(() => {
    if (!itemW) return;
    Animated.spring(x, { toValue: state.index * itemW, useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.8 }).start();
  }, [state.index, itemW]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View pointerEvents="box-none" style={[s.dock, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <MiniPlayer />
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
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
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
