import { ReactNode, useMemo } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Palette, space, useTheme } from '../theme';
import { Glass } from './Glass';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  // Draw over the current screen instead of in a native Modal window. Needed by popups that open a
  // system picker (a Modal closing while another opens, or a picker launching from one, is unreliable
  // on Android). Parent must be a positioned view that fills the screen.
  inline?: boolean;
};

// Shared frame for popups: a dimmed (and, on iOS, blurred) backdrop and a firm glass card, so the
// text on the card is not fighting with whatever is behind it.
export function DialogFrame({ visible, onClose, children, inline = false }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const body = (
    <View style={[s.scrim, inline && s.inline]}>
      {/* a Modal cannot blur the app behind it on Android, so there the heavier dim does the work */}
      {Platform.OS === 'ios' && <BlurView pointerEvents="none" intensity={30} tint={t.blurTint} style={StyleSheet.absoluteFill} />}
      {/* tap outside the card to close. A sibling of the card, NOT its parent: a Pressable around the
          card swallows taps meant for the buttons inside it on Android. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={s.cardWrap}>
        <Glass opaque radius={28} style={{ alignSelf: 'stretch' }}>
          {children}
        </Glass>
      </View>
    </View>
  );

  if (inline) return visible ? body : null;
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {body}
    </Modal>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: t.isDark ? 'rgba(0,0,0,0.68)' : 'rgba(20,20,50,0.5)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
    inline: { ...StyleSheet.absoluteFillObject, flex: undefined, zIndex: 50, elevation: 50 },
    cardWrap: { alignSelf: 'stretch', maxWidth: 420 },
  });
