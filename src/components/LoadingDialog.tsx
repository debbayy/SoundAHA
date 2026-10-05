import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Palette, space, useTheme } from '../theme';
import { DialogFrame } from './DialogFrame';

type Props = {
  visible: boolean;
  title: string;
  message?: string; // e.g. "Song 2 of 5"
};

// Blocking "please wait" card for slow work (copying songs, reading a folder). The spinner is a
// native view, so it keeps turning even while the JS thread is busy reading files.
export function LoadingDialog({ visible, title, message }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <DialogFrame visible={visible} onClose={() => {}}>
      <View style={s.card} accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={t.accent2} />
        <Text style={s.title}>{title}</Text>
        {!!message && <Text style={s.msg}>{message}</Text>}
      </View>
    </DialogFrame>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    card: { padding: space.xl, alignItems: 'center' },
    title: { fontSize: 18, fontWeight: '800', color: t.text, textAlign: 'center', marginTop: space.md },
    msg: { fontSize: 14, color: t.muted, textAlign: 'center', marginTop: space.xs },
  });
