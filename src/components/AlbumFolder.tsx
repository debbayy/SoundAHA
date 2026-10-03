import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Palette, useTheme } from '../theme';
import { Album, Sound } from '../types';
import { Glass } from './Glass';
import { LiquidButton } from './LiquidButton';

type Props = {
  album: Album;
  songs: Sound[]; // the songs inside it
  onOpen: () => void;
  onDelete: () => void;
};

// An album shown as a folder: its name, how many songs it holds, and the first cover found inside.
export function AlbumFolder({ album, songs, onOpen, onDelete }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const cover = songs.find((x) => x.cover_url)?.cover_url;

  return (
    <View style={s.outer}>
      <Glass blur={false}>
        <View style={s.row}>
          <Pressable
            style={({ pressed }) => [s.main, pressed && { opacity: 0.7 }]}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(); }}
            accessibilityRole="button"
            accessibilityLabel={`Open album ${album.name}`}
          >
            <View style={s.thumb}>
              {cover ? (
                <Image source={{ uri: cover }} style={s.cover} resizeMode="cover" />
              ) : (
                <Ionicons name="folder" size={26} color={t.accent2} />
              )}
              {cover && <View style={s.badge}><Ionicons name="folder" size={11} color="#fff" /></View>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{album.name}</Text>
              <Text style={s.sub}>{songs.length} {songs.length === 1 ? 'SONG' : 'SONGS'}  ·  ALBUM</Text>
            </View>
          </Pressable>
          <LiquidButton compact hitSlop={6} style={s.icon} wrapStyle={s.gap} onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Delete album ${album.name}`}>
            <Ionicons name="trash-outline" size={18} color={t.btnText} />
          </LiquidButton>
          <Ionicons name="chevron-forward" size={18} color={t.muted} />
        </View>
      </Glass>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    outer: { marginBottom: 10 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
    main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    thumb: { width: 48, height: 48, borderRadius: 16, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'visible' },
    cover: { width: 48, height: 48, borderRadius: 16 },
    badge: { position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: t.bg },
    name: { fontSize: 16, fontWeight: '700', color: t.text },
    sub: { fontSize: 11, color: t.muted, marginTop: 3, letterSpacing: 1, fontWeight: '500' },
    gap: { marginHorizontal: 6 },
    icon: { width: 38, height: 38 },
  });
