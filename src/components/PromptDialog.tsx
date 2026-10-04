import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Palette, space, useTheme } from '../theme';
import { DialogFrame } from './DialogFrame';
import { GlassButton } from './GlassButton';

type Props = {
  visible: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
};

// Asks for one line of text (a playlist name).
export function PromptDialog({ visible, title, initial = '', placeholder, confirmLabel = 'Save', onSubmit, onCancel }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const [text, setText] = useState(initial);
  useEffect(() => { if (visible) setText(initial); }, [visible]);
  const ok = text.trim().length > 0;
  const submit = () => { if (ok) onSubmit(text.trim()); };

  return (
    <DialogFrame visible={visible} onClose={onCancel}>
      <View style={s.card}>
        <Text style={s.title}>{title}</Text>
        <TextInput
          style={s.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={t.muted}
          selectionColor={t.accent2}
          autoFocus
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <View style={s.actions}>
          <GlassButton variant="glass" label="Cancel" onPress={onCancel} style={{ flex: 1 }} />
          <GlassButton label={confirmLabel} onPress={submit} disabled={!ok} style={{ flex: 1 }} />
        </View>
      </View>
    </DialogFrame>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    card: { padding: space.lg },
    title: { fontSize: 20, fontWeight: '800', color: t.text, textAlign: 'center' },
    input: { height: 48, borderRadius: 14, paddingHorizontal: 14, marginVertical: space.lg, fontSize: 16, color: t.text, backgroundColor: t.fillStrong },
    actions: { flexDirection: 'row', gap: 10 },
  });
