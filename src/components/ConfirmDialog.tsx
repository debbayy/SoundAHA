import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Palette, space, useTheme } from '../theme';
import { Glass } from './Glass';
import { GlassButton } from './GlassButton';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// In-app confirmation (instead of the native Alert) so it matches the glass theme.
export function ConfirmDialog({ visible, title, message, confirmLabel = 'Remove', onConfirm, onCancel }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={s.scrim} onPress={onCancel}>
        <Pressable style={s.cardWrap} onPress={() => {}}>
          <Glass radius={28} style={{ alignSelf: 'stretch' }}>
            <View style={s.card}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.msg}>{message}</Text>
              <View style={s.actions}>
                <GlassButton variant="glass" label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
                <GlassButton label={confirmLabel} onPress={onConfirm} style={{ flex: 1 }} />
              </View>
            </View>
          </Glass>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: t.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(20,20,50,0.35)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
    cardWrap: { alignSelf: 'stretch', maxWidth: 420 },
    card: { padding: space.lg },
    title: { fontSize: 20, fontWeight: '800', color: t.text, textAlign: 'center' },
    msg: { fontSize: 14, color: t.muted, textAlign: 'center', marginTop: space.xs, marginBottom: space.lg },
    actions: { flexDirection: 'row', gap: 10 },
  });
