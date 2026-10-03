import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Palette, space, useTheme } from '../theme';
import { DialogFrame } from './DialogFrame';
import { LiquidButton } from './LiquidButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSongs: () => void;
  onAlbum: () => void;
};

type Icon = keyof typeof Ionicons.glyphMap;

// "+" menu: add individual songs, or a whole folder as an album. Only .mp3 files are accepted.
export function AddDialog({ visible, onClose, onSongs, onAlbum }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  // The picker opens right away while this popup is still up (it is hidden behind the system picker).
  // The caller closes the popup once the picker is done. Opening the picker while the popup was
  // fading out made it fail to appear on Android.
  const choose = (fn: () => void) => () => fn();
  const option = (icon: Icon, title: string, subtitle: string, onPress: () => void) => (
    <LiquidButton radius={24} wrapStyle={s.optionWrap} style={s.option} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
      <View style={s.iconBox}><Ionicons name={icon} size={22} color={t.accent2} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.muted} />
    </LiquidButton>
  );

  return (
    <DialogFrame inline visible={visible} onClose={onClose}>
      <View style={s.card}>
        {option('musical-notes', 'Add songs', 'Pick one .mp3, or select several at once', choose(onSongs))}
        {option('folder-open', 'Add album', 'Pick a folder. It becomes an album named after the folder', choose(onAlbum))}
      </View>
    </DialogFrame>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    card: { padding: space.lg },
    title: { fontSize: 20, fontWeight: '800', color: t.text, textAlign: 'center' },
    msg: { fontSize: 14, color: t.muted, textAlign: 'center', marginTop: space.xs, marginBottom: space.lg },
    optionWrap: { marginBottom: space.sm },
    option: { minHeight: 76, flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
    iconBox: { width: 44, height: 44, borderRadius: 15, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
    optionTitle: { fontSize: 16, fontWeight: '700', color: t.text },
    optionSub: { fontSize: 12, color: t.muted, marginTop: 2 },
  });
