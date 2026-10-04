import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sound } from '../types';
import {
  addToPlaylist as addIn, createPlaylist as createIn, deletePlaylist as deleteIn, emptyPlaylists, emptyStats,
  parsePlaylists, parseStats, PlaylistStore, PlayStats, recordPlay as recordIn, removeFromPlaylist as removeIn,
  renamePlaylist as renameIn,
} from '../lib/library';

const PLAYLISTS_KEY = 'soundly.playlists';
const STATS_KEY = 'soundly.playStats';

type Ctx = {
  playlists: PlaylistStore;
  stats: PlayStats;
  createPlaylist: (name: string, first?: Sound) => string; // returns the new playlist's id
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, s: Sound) => void;
  removeFromPlaylist: (id: string, soundId: string) => void;
  recordPlay: (s: Sound) => void;
};
const noop = () => {};
const LibraryCtx = createContext<Ctx>({
  playlists: emptyPlaylists, stats: emptyStats, createPlaylist: () => '', renamePlaylist: noop, deletePlaylist: noop,
  addToPlaylist: noop, removeFromPlaylist: noop, recordPlay: noop,
});
export const useLibrary = () => useContext(LibraryCtx);

// Playlists and play history, kept on the phone.
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<PlaylistStore>(emptyPlaylists);
  const [stats, setStats] = useState<PlayStats>(emptyStats);
  const plRef = useRef(playlists);
  const statsRef = useRef(stats);

  useEffect(() => {
    AsyncStorage.multiGet([PLAYLISTS_KEY, STATS_KEY])
      .then(([[, pl], [, st]]) => {
        // anything changed before loading finished is kept on top of what was saved
        if (plRef.current === emptyPlaylists) { plRef.current = parsePlaylists(pl); setPlaylists(plRef.current); }
        if (statsRef.current === emptyStats) { statsRef.current = parseStats(st); setStats(statsRef.current); }
      })
      .catch(() => {});
  }, []);

  const savePlaylists = useCallback((next: PlaylistStore) => {
    plRef.current = next;
    setPlaylists(next);
    AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => ({
    playlists,
    stats,
    createPlaylist: (name, first) => {
      const id = `pl-${Date.now().toString(36)}`;
      savePlaylists(createIn(plRef.current, name, id, first));
      return id;
    },
    renamePlaylist: (id, name) => savePlaylists(renameIn(plRef.current, id, name)),
    deletePlaylist: (id) => savePlaylists(deleteIn(plRef.current, id)),
    addToPlaylist: (id, s) => savePlaylists(addIn(plRef.current, id, s)),
    removeFromPlaylist: (id, soundId) => savePlaylists(removeIn(plRef.current, id, soundId)),
    recordPlay: (s) => {
      statsRef.current = recordIn(statsRef.current, s);
      setStats(statsRef.current);
      AsyncStorage.setItem(STATS_KEY, JSON.stringify(statsRef.current)).catch(() => {});
    },
  }), [playlists, stats, savePlaylists]);

  return <LibraryCtx.Provider value={value}>{children}</LibraryCtx.Provider>;
}
