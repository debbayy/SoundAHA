import { ReactNode, useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Palette, space, useTheme } from '../theme';
import { Glass } from './Glass';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

// Shared frame for popups: a dimmed (and, on iOS, blurred) backdrop and a firm glass card, so the
// text on the card is not fighting with whatever is behind it.
export function DialogFrame({ visible, onClose, children }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        {/* a Modal cannot blur the app behind it on Android, so there the heavier dim does the work */}
        {Platform.OS === 'ios' && <BlurView pointerEvents="none" intensity={30} tint={t.blurTint} style={StyleSheet.absoluteFill} />}
        <Pressable style={s.cardWrap} onPress={() => {}}>
          <Glass opaque radius={28} style={{ alignSelf: 'stretch' }}>
            {children}
          </Glass>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: t.isDark ? 'rgba(0,0,0,0.68)' : 'rgba(20,20,50,0.5)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
    cardWrap: { alignSelf: 'stretch', maxWidth: 420 },
  });
