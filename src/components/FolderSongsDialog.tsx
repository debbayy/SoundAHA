import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../theme';
import { FolderScan, FolderSong } from '../context/LocalSoundsContext';
import { DialogFrame } from './DialogFrame';
import { GlassButton } from './GlassButton';

type Props = {
  scan: FolderScan | null; // the folder the user opened; null hides the dialog
  libraryTitles: Set<string>; // normalized titles already in My Sounds
  normTitle: (s: string) => string;
  onImport: (songs: FolderSong[], onProgress: (done: number) => void) => Promise<void>;
  onClose: () => void;
};

// Shows the songs found in the opened folder (only audio files), all ticked, so the user can add
// the whole folder at once or untick the ones they don't want.
export function FolderSongsDialog({ scan, libraryTitles, normTitle, onImport, onClose }: Props) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const songs = scan?.songs ?? [];
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<number | null>(null); // songs done while importing

  const inLibrary = (x: FolderSong) => libraryTitles.has(normTitle(x.title));

  // a freshly opened folder starts with every song that isn't in the library yet ticked
  useEffect(() => {
    setPicked(new Set(songs.filter((x) => !inLibrary(x)).map((x) => x.uri)));
    setProgress(null);
  }, [scan]);

  const busy = progress !== null;
  const allOn = songs.length > 0 && picked.size === songs.length;
  const toggle = (uri: string) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(uri)) n.delete(uri); else n.add(uri);
      return n;
    });
  };
  const toggleAll = () => {
    Haptics.selectionAsync().catch(() => {});
    setPicked(allOn ? new Set() : new Set(songs.map((x) => x.uri)));
  };

  const start = async () => {
    const chosen = songs.filter((x) => picked.has(x.uri));
    setProgress(0);
    try {
      await onImport(chosen, setProgress);
    } finally {
      setProgress(null);
    }
  };

  return (
    <DialogFrame visible={!!scan} onClose={busy ? () => {} : onClose}>
      <View style={s.card}>
        <View style={s.head}>
          <Ionicons name="folder-open" size={22} color={t.accent2} />
          <Text style={s.title} numberOfLines={1}>{scan?.folderName}</Text>
        </View>
        <Text style={s.sub}>
          {songs.length ? `${songs.length} ${songs.length === 1 ? 'song' : 'songs'} found` : 'No songs in this folder'}
        </Text>

        {songs.length > 0 && (
          <>
            <Pressable onPress={toggleAll} disabled={busy} style={s.allRow} accessibilityRole="checkbox" accessibilityState={{ checked: allOn }}>
              <Ionicons name={allOn ? 'checkbox' : 'square-outline'} size={22} color={allOn ? t.accent : t.muted} />
              <Text style={s.allText}>Select all</Text>
              <Text style={s.count}>{picked.size} selected</Text>
            </Pressable>
            <FlatList
              data={songs}
              keyExtractor={(x) => x.uri}
              style={s.list}
              renderItem={({ item }) => {
                const on = picked.has(item.uri);
                const owned = inLibrary(item);
                return (
                  <Pressable
                    onPress={() => toggle(item.uri)}
                    disabled={busy}
                    style={({ pressed }) => [s.row, pressed && { opacity: 0.6 }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                  >
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.accent : t.muted} />
                    <View style={s.art}><Ionicons name="musical-note" size={16} color={t.text} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name} numberOfLines={1}>{item.title}</Text>
                      <Text style={s.file} numberOfLines={1}>{owned ? 'Already in My Sounds' : item.name}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          </>
        )}

        <View style={s.actions}>
          <GlassButton variant="glass" label={busy ? `${progress}/${picked.size}` : 'Cancel'} onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          {songs.length > 0 && (
            <GlassButton label={`Add ${picked.size}`} onPress={start} busy={busy} disabled={!picked.size} style={{ flex: 1 }} />
          )}
        </View>
      </View>
    </DialogFrame>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    card: { padding: space.lg },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
    title: { fontSize: 20, fontWeight: '800', color: t.text, flexShrink: 1 },
    sub: { fontSize: 14, color: t.muted, textAlign: 'center', marginTop: space.xs, marginBottom: space.md },
    allRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: t.border },
    allText: { color: t.text, fontWeight: '700', flex: 1 },
    count: { color: t.muted, fontSize: 12 },
    list: { maxHeight: 360, marginBottom: space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    art: { width: 34, height: 34, borderRadius: 10, backgroundColor: t.fill, alignItems: 'center', justifyContent: 'center' },
    name: { color: t.text, fontWeight: '600', fontSize: 14 },
    file: { color: t.muted, fontSize: 11, marginTop: 1 },
    actions: { flexDirection: 'row', gap: 10 },
  });
