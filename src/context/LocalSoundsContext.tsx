import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Sound } from '../types';

const KEY = 'soundly.localSounds';
const isNative = Platform.OS !== 'web';

type Ctx = {
  localSounds: Sound[];
  importSounds: () => Promise<number>; // returns how many files were added
  removeSound: (id: string) => void;
};
const LocalCtx = createContext<Ctx>({ localSounds: [], importSounds: async () => 0, removeSound: () => {} });
export const useLocalSounds = () => useContext(LocalCtx);

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
      .then((raw) => raw && setLocalSounds(JSON.parse(raw)))
      .catch(() => {});
  }, []);

  const persist = (list: Sound[]) => {
    setLocalSounds(list);
    if (isNative) AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
  };

  const importSounds = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'audio/*', multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return 0;
    const added: Sound[] = [];
    for (const a of res.assets) {
      const id = `local-${Date.now()}-${added.length}`;
      try {
        const uri = isNative ? copyIntoApp(a.uri, id, a.name) : a.uri;
        added.push({ id, title: titleOf(a.name), category: 'local', emoji: '📱', duration: 0, audio_url: uri, local: true });
      } catch {
        // skip files that can't be copied
      }
    }
    if (added.length) persist([...added, ...localSounds]);
    return added.length;
  }, [localSounds]);

  const removeSound = useCallback((id: string) => {
    const target = localSounds.find((x) => x.id === id);
    if (target && isNative) {
      try { new File(target.audio_url).delete(); } catch { /* already gone */ }
    }
    persist(localSounds.filter((x) => x.id !== id));
  }, [localSounds]);

  return <LocalCtx.Provider value={{ localSounds, importSounds, removeSound }}>{children}</LocalCtx.Provider>;
}
