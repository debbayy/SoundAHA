import { ReactNode } from 'react';
import { Platform, PressableProps, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { PressableScale } from './PressableScale';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  // Size/padding of the glass body (width, height, paddingHorizontal...).
  style?: StyleProp<ViewStyle>;
  // Layout of the outer pressable (flex, margins, alignSelf).
  wrapStyle?: StyleProp<ViewStyle>;
  radius?: number;
  // Optional color wash over the glass, e.g. the brand gradient for primary actions.
  tint?: readonly [string, string];
  // Smaller drop shadow, for icon buttons and chips.
  compact?: boolean;
  scaleTo?: number;
};

// Liquid-glass button. Port of the CSS `.liquid-btn`: 1px light border, near-transparent body,
// inset rim light + drop shadow, a glossy highlight over the top half, a springy press.
export function LiquidButton({
  children, label, labelStyle, style, wrapStyle, radius = 999, tint, compact, scaleTo = 0.97, disabled, ...rest
}: Props) {
  const t = useTheme();
  const shadow = compact ? t.btnShadowSm : t.btnShadow;
  return (
    <PressableScale {...rest} disabled={disabled} scaleTo={scaleTo} wrapStyle={[wrapStyle, disabled && { opacity: 0.45 }]}>
      <View
        style={[
          s.body,
          { borderRadius: radius, borderColor: t.btnBorder, backgroundColor: t.btnFill, boxShadow: `${t.btnRim}, ${shadow}` },
          style,
        ]}
      >
        {Platform.OS === 'ios' && <BlurView intensity={18} tint={t.blurTint} style={StyleSheet.absoluteFill} />}
        {tint && (
          <LinearGradient pointerEvents="none" colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        {/* ::before — glossy highlight: inset 2px 8% 52% 8% */}
        <LinearGradient
          pointerEvents="none"
          colors={t.btnHighlight}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.gloss}
        />
        {label ? <Text style={[s.label, { color: tint ? '#fff' : t.btnText }, labelStyle]}>{label}</Text> : children}
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  body: { overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  gloss: { position: 'absolute', top: 2, left: '8%', right: '8%', bottom: '52%', borderRadius: 999 },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
});
