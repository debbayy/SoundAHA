import { ReactNode } from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  // Real backdrop blur is costly on Android; turn it off for repeated items (list rows).
  blur?: boolean;
};

// Liquid-glass surface: raised (soft outer shadow), a lit inner rim, a soft top sheen and one thin
// specular line along the top edge. No true refraction in plain React Native, so it is built from
// layered shadows/gradients; kept deliberately minimal so it stays tidy.
export function Glass({ children, style, radius = 22, intensity = 40, blur = true }: Props) {
  const t = useTheme();
  // Android's blur renders washed-out/whitish, so there the glass is a tinted layer instead.
  const realBlur = blur && Platform.OS === 'ios';
  const fill = realBlur ? t.glassBlur : blur ? t.glassSolid : t.glassRow;
  // Repeated list rows skip the outer shadow and the specular line.
  const boxShadow = blur ? `${t.dropShadow}, ${t.dropRim}` : t.dropRim;
  const inset = Math.min(radius, 28) * 0.8;

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', boxShadow }, style]}>
      {realBlur && <BlurView intensity={intensity} tint={t.blurTint} style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      <LinearGradient
        pointerEvents="none"
        colors={[t.sheen[0], t.sheen[1], 'transparent']}
        locations={[0, 0.4, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {blur && (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', t.specular, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', top: 1, left: inset, right: inset, height: 1.5, borderRadius: 1 }}
        />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth * 1.5, borderColor: t.glassStroke }]} />
      {children}
    </View>
  );
}
