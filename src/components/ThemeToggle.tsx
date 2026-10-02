import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ThemeMode, useTheme, useThemeMode } from '../theme';
import { LiquidButton } from './LiquidButton';
import { BRAND_TINT } from './tints';

// Round glass button: sun in dark mode (tap -> light), moon in light mode (tap -> dark).
export function ThemeToggle() {
  const t = useTheme();
  const { scheme, toggle } = useThemeMode();
  return (
    <LiquidButton
      compact
      style={s.round}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); toggle(); }}
      accessibilityRole="button"
      accessibilityLabel={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <Ionicons name={scheme === 'dark' ? 'sunny' : 'moon'} size={22} color={t.btnText} />
    </LiquidButton>
  );
}

const OPTIONS: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

// 3-way picker for the Profile screen: three equal liquid buttons, the selected one tinted.
export function ThemePicker() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  return (
    <View style={s.row}>
      {OPTIONS.map((o) => {
        const on = mode === o.key;
        const color = on ? '#fff' : t.btnText;
        return (
          <LiquidButton
            key={o.key}
            compact
            radius={22}
            tint={on ? BRAND_TINT : undefined}
            wrapStyle={s.cell}
            style={s.opt}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); setMode(o.key); }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Ionicons name={o.icon} size={19} color={color} />
            <Text style={[s.label, { color }]}>{o.label}</Text>
          </LiquidButton>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  round: { width: 48, height: 48 },
  row: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  cell: { flex: 1 },
  opt: { height: 72, gap: 6 },
  label: { fontSize: 12, fontWeight: '600' },
});
