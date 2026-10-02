import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../theme';

export function Equalizer({ active }: { active: boolean }) {
  const t = useTheme();
  const bars = useRef([0, 1, 2, 3].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = bars.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 380 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 380 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    if (active) loops.forEach((l) => l.start());
    else bars.forEach((v) => v.setValue(0.3));
    return () => loops.forEach((l) => l.stop());
  }, [active]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 22, marginRight: 14 }}>
      {bars.map((v, i) => (
        <Animated.View key={i} style={{ width: 3, height: 22, borderRadius: 2, backgroundColor: t.accent2, transform: [{ scaleY: v }] }} />
      ))}
    </View>
  );
}
