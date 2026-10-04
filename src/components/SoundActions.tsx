import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../theme';
import { Sound } from '../types';
import { usePlayer } from '../context/PlayerContext';
import { useLibrary } from '../context/LibraryContext';
import { shareSound } from '../lib/shareSound';
import { DialogFrame } from './DialogFrame';
import { MenuRows } from './PlayerMenu';
import { ConfirmDialog } from './ConfirmDialog';

// One popup for the whole app, opened from any song row (long-press), instead of every row mounting
// its own. Its steps (actions -> pick a playlist -> name a new one) swap inside the same dialog:
// closing one dialog and opening another waits for both fade animations on Android.
type Popup = { kind: 'actions' | 'playlist'; sound: Sound } | null;
let popup: Popup = null;
const subs = new Set<() => void>();
const set = (p: Popup) => { popup = p; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export const openSoundActions = (sound: Sound) => set({ kind: 'actions', sound });

// iOS can't open a popup while the previous one is still fading out.
const after = (fn: () => void) => setTimeout(fn, Platform.OS === 'ios' ? 350 : 0);
const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

export function SoundActionsHost() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const p = useSyncExternalStore(subscribe, () => popup);
  const { playNext, addToQueue } = usePlayer();
  const [shareError, setShareError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(id);
  }, [toast]);

  const close = () => set(null);
  const done = (msg: string) => {
    success();
    close();
    after(() => setToast(msg));
  };

  const sound = p?.sound;
  const share = async (x: Sound) => {
    close();
    try { await shareSound(x); } catch (e) { console.warn('[share] failed', e); after(() => setShareError(true)); }
  };

  return (
    <>
      <DialogFrame visible={!!p} onClose={close}>
        {sound && p?.kind === 'actions' && (
          <View>
            <Text style={s.head} numberOfLines={1}>{sound.title}</Text>
            <MenuRows
              items={[
                { key: 'next', icon: 'play-forward-outline', label: 'Play next', onPress: () => { playNext(sound); done('Plays next'); } },
                { key: 'queue', icon: 'list-outline', label: 'Add to queue', onPress: () => { addToQueue(sound); done('Added to queue'); } },
                { key: 'playlist', icon: 'albums-outline', label: 'Add to playlist', onPress: () => set({ kind: 'playlist', sound }) },
                { key: 'share', icon: 'share-outline', label: 'Share', onPress: () => share(sound) },
              ]}
            />
          </View>
        )}
        {sound && p?.kind === 'playlist' && <PlaylistPicker sound={sound} onDone={done} />}
      </DialogFrame>

      <ConfirmDialog
        visible={shareError}
        title="Can't share"
        message="This song couldn't be prepared for sharing. Please try again."
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setShareError(false)}
        onCancel={() => setShareError(false)}
      />
      {toast && (
        <View pointerEvents="none" style={s.toastWrap}>
          <View style={s.toast}>
            <Ionicons name="checkmark-circle" size={18} color={t.accent2} />
            <Text style={s.toastText} numberOfLines={1}>{toast}</Text>
          </View>
        </View>
      )}
    </>
  );
}

// Pick a playlist for a song, or name a new one right here. `onDone` gets a short confirmation.
export function PlaylistPicker({ sound, onDone }: { sound: Sound; onDone: (msg: string) => void }) {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { playlists, addToPlaylist, createPlaylist } = useLibrary();
  const [naming, setNaming] = useState(false); // the inline 'new playlist' field is open
  const [name, setName] = useState('');
  const createWith = () => {
    const n = name.trim();
    if (!n) return;
    createPlaylist(n, sound);
    onDone(`Added to ${n}`);
  };

  return (
    <View>
      <Text style={s.head}>Add to playlist</Text>
      <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
        {naming ? (
          <View style={s.newRow}>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Playlist name"
              placeholderTextColor={t.muted}
              selectionColor={t.accent2}
              autoFocus
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={createWith}
            />
            <Pressable onPress={createWith} disabled={!name.trim()} hitSlop={8} style={[s.create, !name.trim() && { opacity: 0.4 }]} accessibilityRole="button">
              <Text style={s.createText}>Create</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setNaming(true)} style={({ pressed }) => [s.row, pressed && s.pressed]} accessibilityRole="button">
            <Ionicons name="add" size={22} color={t.accent2} style={s.icon} />
            <Text style={[s.label, { color: t.accent2 }]}>New playlist</Text>
          </Pressable>
        )}
        {playlists.lists.map((pl) => {
          const has = pl.ids.includes(sound.id);
          return (
            <Pressable
              key={pl.id}
              disabled={has}
              onPress={() => { addToPlaylist(pl.id, sound); onDone(`Added to ${pl.name}`); }}
              style={({ pressed }) => [s.row, s.divider, pressed && s.pressed]}
              accessibilityRole="button"
              accessibilityState={{ disabled: has }}
            >
              <Ionicons name={has ? 'checkmark-circle' : 'albums-outline'} size={20} color={has ? t.accent2 : t.text} style={s.icon} />
              <Text style={s.label} numberOfLines={1}>{pl.name}</Text>
              <Text style={s.count}>{has ? 'Added' : pl.ids.length}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// The picker as a popup of the screen itself, like the speed dialog. The full-screen player needs
// this: the app-wide popup is mounted at the root, underneath the player.
export function AddToPlaylistDialog({ sound, visible, onClose }: { sound: Sound; visible: boolean; onClose: () => void }) {
  return (
    <DialogFrame visible={visible} onClose={onClose}>
      {visible && <PlaylistPicker sound={sound} onDone={() => { success(); onClose(); }} />}
    </DialogFrame>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    head: { fontSize: 13, fontWeight: '700', color: t.muted, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase', paddingTop: space.lg, paddingBottom: space.sm, paddingHorizontal: space.lg },
    row: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: space.md },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    pressed: { backgroundColor: t.fillStrong },
    icon: { width: 24, marginRight: 12 },
    label: { flex: 1, fontSize: 15, fontWeight: '600', color: t.text },
    count: { fontSize: 13, fontWeight: '700', color: t.muted, marginLeft: 8 },
    newRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.md, paddingVertical: 6 },
    input: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 15, color: t.text, backgroundColor: t.fillStrong },
    create: { paddingHorizontal: 6, paddingVertical: 8 },
    createText: { fontSize: 15, fontWeight: '800', color: t.accent2 },
    toastWrap: { position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center', paddingHorizontal: space.lg },
    toast: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: t.glassModal, maxWidth: '100%', boxShadow: t.dropShadow },
    toastText: { fontSize: 14, fontWeight: '700', color: t.text, flexShrink: 1 },
  });
