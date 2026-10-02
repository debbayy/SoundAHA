import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Palette, space, useTheme } from '../theme';
import { DialogFrame } from './DialogFrame';
import { GlassButton } from './GlassButton';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  hideCancel?: boolean; // notice style: a single OK button
  onConfirm: () => void;
  onCancel: () => void;
};

// In-app confirmation (instead of the native Alert) so it matches the glass theme.
export function ConfirmDialog({ visible, title, message, confirmLabel = 'Remove', hideCancel = false, onConfirm, onCancel }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <DialogFrame visible={visible} onClose={onCancel}>
      <View style={s.card}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.msg}>{message}</Text>
        <View style={s.actions}>
          {!hideCancel && <GlassButton variant="glass" label="Cancel" onPress={onCancel} style={{ flex: 1 }} />}
          <GlassButton label={confirmLabel} onPress={onConfirm} style={{ flex: 1 }} />
        </View>
      </View>
    </DialogFrame>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    card: { padding: space.lg },
    title: { fontSize: 20, fontWeight: '800', color: t.text, textAlign: 'center' },
    msg: { fontSize: 14, color: t.muted, textAlign: 'center', marginTop: space.xs, marginBottom: space.lg },
    actions: { flexDirection: 'row', gap: 10 },
  });
