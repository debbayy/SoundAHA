import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../theme';
import { usePlayer } from '../context/PlayerContext';
import { fmtRemaining, SLEEP_CHOICES, SleepChoice } from '../lib/sleep';
import { DialogFrame } from './DialogFrame';

const label = (c: SleepChoice) => (c === 'end' ? 'End of song' : `${c} min`);

// Remaining time of the sleep timer, ticking once a second while shown. null when it is off.
export function useSleepLeft(): string | null {
  const { sleepEndsAt, sleepEndOfSong } = usePlayer();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (sleepEndsAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sleepEndsAt]);
  if (sleepEndOfSong) return 'End of song';
  return sleepEndsAt === null ? null : fmtRemaining(sleepEndsAt - now);
}

// Sleep timer picker: pause playback after a while, or when the current song ends.
export function SleepDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { setSleep } = usePlayer();
  const left = useSleepLeft();

  const choose = (c: SleepChoice | null) => {
    Haptics.selectionAsync().catch(() => {});
    setSleep(c);
    onClose();
  };

  return (
    <DialogFrame visible={visible} onClose={onClose}>
      <View style={s.card}>
        <Text style={s.title}>Sleep timer</Text>
        {left && <Text style={s.left}>{left === 'End of song' ? 'Stops at the end of this song' : `Stops in ${left}`}</Text>}
        <View style={s.grid}>
          {SLEEP_CHOICES.map((c) => (
            <Pressable key={String(c)} onPress={() => choose(c)} style={({ pressed }) => [s.chip, c === 'end' && s.wide, pressed && s.pressed]} accessibilityRole="button">
              <Text style={s.chipText}>{label(c)}</Text>
            </Pressable>
          ))}
        </View>
        {left && (
          <Pressable onPress={() => choose(null)} hitSlop={10} style={s.off} accessibilityRole="button">
            <Text style={s.offText}>Turn off</Text>
          </Pressable>
        )}
      </View>
    </DialogFrame>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    card: { paddingVertical: space.lg, paddingHorizontal: space.xl },
    title: { fontSize: 14, fontWeight: '700', color: t.muted, textAlign: 'center', letterSpacing: 1.2, textTransform: 'uppercase' },
    left: { fontSize: 15, fontWeight: '700', color: t.accent2, textAlign: 'center', marginTop: space.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: space.md },
    chip: { flexGrow: 1, flexBasis: '45%', height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: t.fillStrong },
    wide: { flexBasis: '100%' },
    pressed: { opacity: 0.6 },
    chipText: { fontSize: 15, fontWeight: '700', color: t.text },
    off: { alignSelf: 'center', marginTop: space.md, paddingVertical: 6, paddingHorizontal: 12 },
    offText: { fontSize: 13, fontWeight: '700', color: t.danger },
  });
