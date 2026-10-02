import { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import { LiquidButton } from './LiquidButton';
import { BRAND_TINT } from './tints';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'glass';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>; // layout of the button (flex, margins)
};

export function GlassButton({ label, onPress, variant = 'primary', busy, disabled, style }: Props) {
  const t = useTheme();
  const primary = variant === 'primary';
  return (
    <LiquidButton
      label={busy ? undefined : label}
      disabled={disabled || busy}
      tint={primary ? BRAND_TINT : undefined}
      wrapStyle={style}
      style={{ height: 54, paddingHorizontal: 36 }}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
    >
      {busy ? <ActivityIndicator color={primary ? '#fff' : t.text} /> : null}
    </LiquidButton>
  );
}
