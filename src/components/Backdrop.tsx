import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { LITE } from '../lib/perf';

const orb = (size: number, color: string, style: object) => (
  <LinearGradient
    pointerEvents="none"
    colors={[color, 'transparent']}
    start={{ x: 0.5, y: 0.5 }}
    end={{ x: 1, y: 1 }}
    style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }, style]}
  />
);

// Soft colored light behind the UI. Glass only reads as glass when there is
// something colorful underneath it. Low-end phones get the plain background: three screen-sized
// translucent layers under everything cost more fill rate than their GPUs have.
export function Backdrop({ children }: { children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      {!LITE && orb(420, t.orbs[0], { top: -140, left: -120 })}
      {!LITE && orb(380, t.orbs[1], { top: 220, right: -170 })}
      {!LITE && orb(460, t.orbs[2], { bottom: -180, left: -140 })}
      {children}
    </View>
  );
}

const s = StyleSheet.create({ root: { flex: 1, overflow: 'hidden' } });
