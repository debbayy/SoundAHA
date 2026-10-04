import { ComponentProps, useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, space, useTheme } from '../theme';
import { Glass } from './Glass';

export type MenuItem = {
  key: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string; // short state shown on the right (On / Off, time left)
  active?: boolean; // tints the icon
  busy?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  top: number; // distance from the top of the screen to place the menu under its button
  items: MenuItem[];
  onClose: () => void;
};

// Drop-down menu from the "more" button at the top right of the player. Tapping outside closes it.
export function PlayerMenu({ visible, top, items, onClose }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[s.wrap, { top }]} pointerEvents="box-none">
        <Glass opaque radius={18}>
          {items.map((it, i) => (
            <Pressable
              key={it.key}
              onPress={it.onPress}
              disabled={it.busy}
              style={({ pressed }) => [s.item, i > 0 && s.divider, pressed && s.pressed]}
              accessibilityRole="menuitem"
              accessibilityLabel={it.value ? `${it.label}: ${it.value}` : it.label}
            >
              {it.busy
                ? <ActivityIndicator size="small" color={t.text} style={s.icon} />
                : <Ionicons name={it.icon} size={20} color={it.active ? t.accent2 : t.text} style={s.icon} />}
              <Text style={s.label} numberOfLines={1}>{it.label}</Text>
              {!!it.value && <Text style={[s.value, it.active && { color: t.accent2 }]}>{it.value}</Text>}
            </Pressable>
          ))}
        </Glass>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    wrap: { position: 'absolute', right: space.lg, width: 248 },
    item: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: space.md },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    pressed: { backgroundColor: t.fillStrong },
    icon: { width: 24, marginRight: 12 },
    label: { flex: 1, fontSize: 15, fontWeight: '600', color: t.text },
    value: { fontSize: 13, fontWeight: '700', color: t.muted, marginLeft: 8 },
  });
