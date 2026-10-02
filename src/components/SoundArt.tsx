import { useEffect, useState } from 'react';
import { Image, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Sound } from '../types';

export const coverOf = (s: Sound | null | undefined) => s?.cover_url ?? s?.thumbnail_url ?? null;

type Props = { sound: Sound; size: number; radius?: number; style?: StyleProp<ViewStyle> };

// The song's cover art if it has one (from the file's tags or the server), otherwise its emoji.
export function SoundArt({ sound, size, radius = size * 0.3, style }: Props) {
  const t = useTheme();
  const uri = coverOf(sound);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [uri]);

  return (
    <View
      style={[{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      {uri && !broken ? (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" onError={() => setBroken(true)} />
      ) : (
        <Text style={{ fontSize: size * 0.5 }}>{sound.emoji ?? '🔊'}</Text>
      )}
    </View>
  );
}
