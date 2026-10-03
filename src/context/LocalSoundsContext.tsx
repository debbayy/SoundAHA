import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { copyAsync } from 'expo-file-system/legacy';
import { Album, Sound } from '../types';
import { readLocalMeta } from '../lib/readMeta';
import { fingerprintFile } from '../lib/fingerprint';
import { hasMp3Name, hasOtherExtension, looksLikeMp3, nameFromUri } from '../lib/mp3';
import { pickFolder } from '../lib/pickFolder';

const KEY = 'soundly.localSounds';
const ALBUMS_KEY = 'soundly.albums';
const isNative = Platform.OS !== 'web';

// What an import did, so the UI can tell the user about anything that was not added.
export type ImportResult = {
  added: number;
  skippedTitles: string[]; // a song with this title is already in the library
  rejected: string[]; // not a valid .mp3, or could not be read
  albumName?: string; // album that was created (album import)
  albumTaken?: boolean; // album import refused: an album with this name already exists
  empty?: boolean; // the folder has no .mp3 files
  cancelled?: boolean;
};
const NOTHING: ImportResult = { added: 0, skippedTitles: [], rejected: [], cancelled: true };

type Ctx = {
  localSounds: Sound[];
  albums: Album[];
  importSongs: () => Promise<ImportResult>; // pick .mp3 files, one or several
  importAlbum: () => Promise<ImportResult>; // pick a folder: it becomes an album named after the folder
  removeSound: (id: string) => void;
  removeAlbum: (id: string) => string[]; // deletes the album and its songs; returns the removed song ids
};
const LocalCtx = createContext<Ctx>({
  localSounds: [],
  albums: [],
  importSongs: async () => NOTHING,
  importAlbum: async () => NOTHING,
  removeSound: () => {},
  removeAlbum: () => [],
});
export const useLocalSounds = () => useContext(LocalCtx);

// Two titles count as the same when they match ignoring case, spacing and a trailing "(1)" (what
// Android adds to a re-downloaded file). The library keeps one song per title and one album per name.
const normTitle = (s: string) => s.toLowerCase().replace(/\s*\(\d+\)\s*$/, '').replace(/\s+/g, ' ').trim();

const titleOf = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Untitled';

let counter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now()}-${counter++}`;

const tryDelete = (uri?: string) => {
  if (!uri) return;
  try { new File(uri).delete(); } catch { /* already gone */ }
};

// Copy a picked file into the app's own storage so it survives the original being moved/deleted.
// Files from a folder picker on Android are content:// URIs; if a direct copy is refused, the bytes
// are read and written instead.
async function copyIntoApp(uri: string, id: string): Promise<string> {
  const dir = new Directory(Paths.document, 'sounds');
  dir.create({ idempotent: true });
  const dest = new File(dir, `${id}.mp3`);
  if (uri.startsWith('content://')) {
    // a file read straight from the phone's storage: Android's own copy handles these URIs best
    try {
      await copyAsync({ from: uri, to: dest.uri });
      return dest.uri;
    } catch { /* fall through to the other ways */ }
  }
  try {
    new File(uri).copy(dest);
  } catch {
    dest.write(await new File(uri).bytes());
  }
  return dest.uri;
}

type Candidate = { uri: string; name: string };

// Turns picked files into library songs. Only real .mp3 files are accepted, and a song whose title
// (or contents) is already in the library is skipped.
async function ingest(cands: Candidate[], albumId: string | undefined, existing: Sound[]) {
  const added: Sound[] = [];
  const skippedTitles: string[] = [];
  const rejected: string[] = [];
  const seenPrint = new Set(existing.map((x) => x.fingerprint).filter(Boolean) as string[]);
  const seenTitles = new Set(existing.map((x) => normTitle(x.title)));

  for (const c of cands) {
    // The file's real contents decide whether it is an mp3, not its name: some providers hand out
    // files without an extension. A name that clearly says another format is refused up front.
    if (hasOtherExtension(c.name)) { rejected.push(c.name); continue; }
    const id = newId('local');
    let uri: string;
    try {
      uri = await copyIntoApp(c.uri, id);
    } catch {
      rejected.push(c.name);
      continue;
    }
    if (!looksLikeMp3(uri)) { tryDelete(uri); rejected.push(c.name); continue; } // e.g. a renamed non-mp3 file

    const fingerprint = fingerprintFile(uri);
    if (fingerprint && seenPrint.has(fingerprint)) { tryDelete(uri); skippedTitles.push(titleOf(c.name)); continue; }

    const m = readLocalMeta(uri, id);
    const title = m.title || titleOf(c.name);
    if (seenTitles.has(normTitle(title))) {
      tryDelete(uri);
      tryDelete(m.cover_url);
      skippedTitles.push(title);
      continue;
    }

    if (fingerprint) seenPrint.add(fingerprint);
    seenTitles.add(normTitle(title));
    added.push({
      id,
      title,
      artist: m.artist,
      album: m.album,
      album_id: albumId,
      cover_url: m.cover_url,
      meta_checked: true,
      fingerprint: fingerprint ?? undefined,
      category: 'local',
      emoji: '📱',
      duration: 0,
      audio_url: uri,
      local: true,
    });
  }
  return { added, skippedTitles, rejected };
}

export function LocalSoundsProvider({ children }: { children: ReactNode }) {
  const [localSounds, setLocalSounds] = useState<Sound[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  // Latest values for the async import functions (state captured before an await can be stale).
  const soundsRef = useRef<Sound[]>([]);
  const albumsRef = useRef<Album[]>([]);
  soundsRef.current = localSounds;
  albumsRef.current = albums;

  useEffect(() => {
    if (!isNative) return; // web blob: URLs don't survive a reload, so nothing to restore
    AsyncStorage.getItem(ALBUMS_KEY)
      .then((raw) => { if (raw) setAlbums(JSON.parse(raw)); })
      .catch(() => {});
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const list: Sound[] = JSON.parse(raw);
        // Songs imported before tag reading / duplicate checks existed: read them once now.
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

  const saveSounds = (list: Sound[]) => {
    soundsRef.current = list;
    setLocalSounds(list);
    if (isNative) AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
  };
  const saveAlbums = (list: Album[]) => {
    albumsRef.current = list;
    setAlbums(list);
    if (isNative) AsyncStorage.setItem(ALBUMS_KEY, JSON.stringify(list)).catch(() => {});
  };

  const importSongs = useCallback(async (): Promise<ImportResult> => {
    if (!isNative) return NOTHING;
    // 'audio/*' as before: narrower mime lists hide files on some phones. Non-mp3 files are refused afterwards.
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return NOTHING;
    const { added, skippedTitles, rejected } = await ingest(
      res.assets.map((a) => ({ uri: a.uri, name: a.name })),
      undefined,
      soundsRef.current
    );
    if (added.length) saveSounds([...added, ...soundsRef.current]);
    return { added: added.length, skippedTitles, rejected };
  }, []);

  const importAlbum = useCallback(async (): Promise<ImportResult> => {
    if (!isNative) return NOTHING;
    const folder = await pickFolder();
    if (!folder) return NOTHING; // the picker was closed without choosing a folder
    const albumName = folder.name || 'Album';
    if (albumsRef.current.some((a) => normTitle(a.name) === normTitle(albumName))) {
      return { added: 0, skippedTitles: [], rejected: [], albumName, albumTaken: true };
    }

    // only the .mp3 files directly inside the folder; covers, playlists and sub-folders are ignored
    const cands = folder.files
      .map((uri) => ({ uri, name: nameFromUri(uri) }))
      .filter((c) => hasMp3Name(c.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); // 01, 02, ... 10 in order
    if (!cands.length) return { added: 0, skippedTitles: [], rejected: [], albumName, empty: true };

    const albumId = newId('album');
    const { added, skippedTitles, rejected } = await ingest(cands, albumId, soundsRef.current);
    if (!added.length) return { added: 0, skippedTitles, rejected, albumName }; // nothing new: no empty folder
    saveAlbums([{ id: albumId, name: albumName }, ...albumsRef.current]);
    saveSounds([...added, ...soundsRef.current]);
    return { added: added.length, skippedTitles, rejected, albumName };
  }, []);

  const removeSound = useCallback((id: string) => {
    const list = soundsRef.current;
    const target = list.find((x) => x.id === id);
    if (!target) return;
    if (isNative) { tryDelete(target.audio_url); tryDelete(target.cover_url); }
    const next = list.filter((x) => x.id !== id);
    saveSounds(next);
    // an album with no songs left is removed too, so no empty folders pile up
    if (target.album_id && !next.some((x) => x.album_id === target.album_id)) {
      saveAlbums(albumsRef.current.filter((a) => a.id !== target.album_id));
    }
  }, []);

  const removeAlbum = useCallback((id: string) => {
    const doomed = soundsRef.current.filter((x) => x.album_id === id);
    if (isNative) doomed.forEach((x) => { tryDelete(x.audio_url); tryDelete(x.cover_url); });
    saveSounds(soundsRef.current.filter((x) => x.album_id !== id));
    saveAlbums(albumsRef.current.filter((a) => a.id !== id));
    return doomed.map((x) => x.id);
  }, []);

  return (
    <LocalCtx.Provider value={{ localSounds, albums, importSongs, importAlbum, removeSound, removeAlbum }}>
      {children}
    </LocalCtx.Provider>
  );
}
