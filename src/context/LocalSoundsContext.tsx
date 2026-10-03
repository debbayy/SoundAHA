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

const FOLDER_KEY = 'soundly.lastFolder';

export type ImportResult = { added: number; skipped: number; skippedTitles: string[] }; // skipped = songs already in the library
// An audio file found in a folder the user opened (not imported yet).
export type FolderSong = { uri: string; name: string; title: string };
export type FolderScan = { folderName: string; songs: FolderSong[] };

type Ctx = {
  localSounds: Sound[];
  importSounds: () => Promise<ImportResult>;
  pickFolder: () => Promise<FolderScan | null>; // null = the user backed out of the folder picker
  importFromFolder: (songs: FolderSong[], onProgress?: (done: number) => void) => Promise<ImportResult>;
  saveOnline: (s: Sound) => Promise<ImportResult>; // download an online (Freesound) sound into My Sounds
  removeSound: (id: string) => void;
};
const empty: ImportResult = { added: 0, skipped: 0, skippedTitles: [] };
const LocalCtx = createContext<Ctx>({
  localSounds: [],
  importSounds: async () => empty,
  pickFolder: async () => null,
  importFromFolder: async () => empty,
  saveOnline: async () => empty,
  removeSound: () => {},
});
export const useLocalSounds = () => useContext(LocalCtx);

// Two songs count as the same title when they match ignoring case, spacing and a trailing "(1)"
// (what Android adds to a re-downloaded file). The library keeps one entry per title.
export const normTitle = (s: string) => s.toLowerCase().replace(/\s*\(\d+\)\s*$/, '').replace(/\s+/g, ' ').trim();

const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|amr|3gp|wma|mid|midi)$/i;
const MAX_DEPTH = 4; // how deep to look into sub-folders of the opened folder

// Every audio file in `dir` and its sub-folders (hidden folders like .thumbnails are skipped).
function findAudio(dir: Directory, depth = 0): FolderSong[] {
  let entries: (Directory | File)[];
  try { entries = dir.list(); } catch { return []; }
  const out: FolderSong[] = [];
  for (const e of entries) {
    const name = e.name.replace(/\/$/, '');
    if (e instanceof Directory) {
      if (depth < MAX_DEPTH && !name.startsWith('.')) out.push(...findAudio(e, depth + 1));
      continue;
    }
    let isAudio = AUDIO_EXT.test(name);
    if (!isAudio && !name.includes('.')) { try { isAudio = !!e.type?.startsWith('audio/'); } catch { /* unknown type */ } }
    if (isAudio) out.push({ uri: e.uri, name, title: titleOf(name) });
  }
  return out;
}

// Copy a song into the app's own storage so it survives the original being moved/deleted.
// Folder files are content:// URIs, which File.copy can't read, so those go through their bytes.
async function copyIntoApp(uri: string, id: string, name: string): Promise<string> {
  const dir = new Directory(Paths.document, 'sounds');
  dir.create({ idempotent: true });
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '.mp3';
  const dest = new File(dir, `${id}${ext}`);
  const src = new File(uri);
  if (uri.startsWith('content://')) dest.write(await src.bytes());
  else src.copy(dest);
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

  // Adds the given files to the library, skipping songs that are already in it (same contents or same title).
  const addFiles = useCallback(async (files: { uri: string; name: string; artist?: string }[], onProgress?: (done: number) => void): Promise<ImportResult> => {
    const added: Sound[] = [];
    const skippedTitles: string[] = [];
    const seen = new Set(localSounds.map((x) => x.fingerprint).filter(Boolean) as string[]);
    const seenTitles = new Set(localSounds.map((x) => normTitle(x.title)));
    for (let i = 0; i < files.length; i++) {
      const a = files[i];
      onProgress?.(i);
      const id = `local-${Date.now()}-${added.length}`;
      try {
        const uri = isNative ? await copyIntoApp(a.uri, id, a.name) : a.uri;
        const fingerprint = isNative ? fingerprintFile(uri) : null;
        if (fingerprint && seen.has(fingerprint)) {
          // same song already imported: undo the copy
          if (isNative) { try { new File(uri).delete(); } catch { /* ignore */ } }
          skippedTitles.push(titleOf(a.name));
          continue;
        }
        if (fingerprint) seen.add(fingerprint);
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
          artist: m.artist || a.artist,
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
    onProgress?.(files.length);
    if (added.length) persist([...added, ...localSounds]);
    return { added: added.length, skipped: skippedTitles.length, skippedTitles };
  }, [localSounds]);

  const importSounds = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return empty;
    return addFiles(res.assets);
  }, [addFiles]);

  // Opens the system folder picker and lists the songs inside (Android). Android keeps the read
  // permission, so the picker starts in the last folder next time.
  const pickFolder = useCallback(async (): Promise<FolderScan | null> => {
    const last = (await AsyncStorage.getItem(FOLDER_KEY).catch(() => null)) ?? undefined;
    let dir: Directory;
    try {
      dir = (await Directory.pickDirectoryAsync(last)) as Directory; // returns the JS Directory at runtime; the typings say the native one
    } catch (e) {
      if (String(e).toLowerCase().includes('cancel')) return null;
      throw e;
    }
    if (!dir?.uri) return null;
    AsyncStorage.setItem(FOLDER_KEY, dir.uri).catch(() => {});
    const songs = findAudio(dir).sort((a, b) => a.title.localeCompare(b.title));
    const folderName = decodeURIComponent(dir.uri).replace(/\/$/, '').split(/[/:]/).pop() || 'Folder';
    return { folderName, songs };
  }, []);

  const importFromFolder = useCallback(
    (songs: FolderSong[], onProgress?: (done: number) => void) => addFiles(songs, onProgress),
    [addFiles],
  );

  // Online previews have no tags, so the title / author come from the search result.
  const saveOnline = useCallback(async (snd: Sound): Promise<ImportResult> => {
    if (!isNative) return addFiles([{ uri: snd.audio_url, name: `${snd.title}.mp3`, artist: snd.artist }]);
    const tmp = new File(Paths.cache, `online-${snd.id}.mp3`);
    await File.downloadFileAsync(snd.audio_url, tmp, { idempotent: true });
    try {
      return await addFiles([{ uri: tmp.uri, name: `${snd.title}.mp3`, artist: snd.artist }]);
    } finally {
      try { tmp.delete(); } catch { /* ignore */ }
    }
  }, [addFiles]);

  const removeSound = useCallback((id: string) => {
    const target = localSounds.find((x) => x.id === id);
    if (target && isNative) {
      try { new File(target.audio_url).delete(); } catch { /* already gone */ }
      if (target.cover_url) { try { new File(target.cover_url).delete(); } catch { /* already gone */ } }
    }
    persist(localSounds.filter((x) => x.id !== id));
  }, [localSounds]);

  return <LocalCtx.Provider value={{ localSounds, importSounds, pickFolder, importFromFolder, saveOnline, removeSound }}>{children}</LocalCtx.Provider>;
}
