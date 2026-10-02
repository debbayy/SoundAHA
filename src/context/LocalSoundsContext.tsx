import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Sound } from '../types';
import { readLocalMeta } from '../lib/readMeta';
import { fingerprintFile } from '../lib/fingerprint';

const KEY = 'soundly.localSounds';
const isNative = Platform.OS !== 'web';

type Ctx = {
  localSounds: Sound[];
  importSounds: () => Promise<{ added: number; skipped: number; skippedTitles: string[] }>; // skipped = songs already in the library
  removeSound: (id: string) => void;
};
const LocalCtx = createContext<Ctx>({ localSounds: [], importSounds: async () => ({ added: 0, skipped: 0, skippedTitles: [] }), removeSound: () => {} });
export const useLocalSounds = () => useContext(LocalCtx);

// Two songs count as the same title when they match ignoring case, spacing and a trailing "(1)"
// (what Android adds to a re-downloaded file). The library keeps one entry per title.
const normTitle = (s: string) => s.toLowerCase().replace(/s*(d+)s*$/, '').replace(/s+/g, ' ').trim();

const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';

// Copy the picked file into the app's own storage so it survives the original being moved/deleted.
function copyIntoApp(uri: string, id: string, name: string): string {
  const dir = new Directory(Paths.document, 'sounds');
  dir.create({ idempotent: true });
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '.mp3';
  const dest = new File(dir, `${id}${ext}`);
  new File(uri).copy(dest);
  return dest.uri;
}

export function LocalSoundsProvider({ children }: { children: ReactNode }) {
  const [localSounds, setLocalSounds] = useState<Sound[]>([]);

  useEffect(() => {
    if (!isNative) return; // web blob: URLs don't survive a reload, so nothing to restore
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const list: Sound[] = JSON.parse(raw);
        // Songs imported before tag reading existed: read their tags once now.
        let changed = false;
        const next = list.map((x) => {
          if (!x.local) return x;
          let y = x;
          if (!y.meta_checked) {
            changed = true;
            const m = readLocalMeta(y.audio_url, y.id);
            y = { ...y, title: m.title || y.title, artist: m.artist, album: m.album, cover_url: m.cover_url, meta_checked: true };
          }
          if (!y.fingerprint) {
            const fp = fingerprintFile(y.audio_url);
            if (fp) { changed = true; y = { ...y, fingerprint: fp }; }
          }
          return y;
        });
        setLocalSounds(next);
        if (changed) AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      })
      .catch(() => {});
  }, []);

  const persist = (list: Sound[]) => {
    setLocalSounds(list);
    if (isNative) AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
  };

  const importSounds = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return { added: 0, skipped: 0, skippedTitles: [] };
    const added: Sound[] = [];
    const skippedTitles: string[] = [];
    const seen = new Set(localSounds.map((x) => x.fingerprint).filter(Boolean) as string[]);
    const seenTitles = new Set(localSounds.map((x) => normTitle(x.title)));
    for (const a of res.assets) {
      const fingerprint = isNative ? fingerprintFile(a.uri) : null;
      if (fingerprint && seen.has(fingerprint)) { skippedTitles.push(titleOf(a.name)); continue; } // same song already imported
      if (fingerprint) seen.add(fingerprint);
      const id = `local-${Date.now()}-${added.length}`;
      try {
        const uri = isNative ? copyIntoApp(a.uri, id, a.name) : a.uri;
        const m = isNative ? readLocalMeta(uri, id) : {};
        const title = m.title || titleOf(a.name);
        if (seenTitles.has(normTitle(title))) {
          // a song with this title is already in the library: undo the copy and skip it
          if (isNative) {
            try { new File(uri).delete(); } catch { /* ignore */ }
            if (m.cover_url) { try { new File(m.cover_url).delete(); } catch { /* ignore */ } }
          }
          skippedTitles.push(title);
          continue;
        }
        seenTitles.add(normTitle(title));
        added.push({
          id,
          title,
          artist: m.artist,
          album: m.album,
          cover_url: m.cover_url,
          meta_checked: true,
          fingerprint: fingerprint ?? undefined,
          category: 'local',
          emoji: '📱',
          duration: 0,
          audio_url: uri,
          local: true,
        });
      } catch {
        // skip files that can't be copied
      }
    }
    if (added.length) persist([...added, ...localSounds]);
    return { added: added.length, skipped: skippedTitles.length, skippedTitles };
  }, [localSounds]);

  const removeSound = useCallback((id: string) => {
    const target = localSounds.find((x) => x.id === id);
    if (target && isNative) {
      try { new File(target.audio_url).delete(); } catch { /* already gone */ }
      if (target.cover_url) { try { new File(target.cover_url).delete(); } catch { /* already gone */ } }
    }
    persist(localSounds.filter((x) => x.id !== id));
  }, [localSounds]);

  return <LocalCtx.Provider value={{ localSounds, importSounds, removeSound }}>{children}</LocalCtx.Provider>;
}
