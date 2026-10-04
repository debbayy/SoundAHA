import { Sound } from '../types';

// Songs are referred to by id in favorites, playlists and play history. Online (Freesound) results
// exist in no other list, so a copy of each referenced one is kept next to the ids.
export type Snapshots = Record<string, Sound>;

export function lookup(lists: Sound[][], snapshots: Snapshots = {}) {
  const byId = new Map<string, Sound>();
  for (const list of lists) for (const s of list) if (!byId.has(s.id)) byId.set(s.id, s);
  return (id: string): Sound | undefined => byId.get(id) ?? snapshots[id];
}

// The songs for `ids`, in order, skipping ones that no longer exist (a deleted import, a sound
// removed from the server).
export function resolveIds(ids: string[], lists: Sound[][], snapshots: Snapshots = {}): Sound[] {
  const find = lookup(lists, snapshots);
  return ids.map(find).filter((x): x is Sound => !!x);
}

// Keep only the snapshots still referenced by `ids`.
export function pruneSnapshots(snapshots: Snapshots, ids: Iterable<string>): Snapshots {
  const keep = new Set(ids);
  const out: Snapshots = {};
  for (const id of Object.keys(snapshots)) if (keep.has(id)) out[id] = snapshots[id];
  return out;
}

export const snapshotIfOnline = (snapshots: Snapshots, s: Sound): Snapshots =>
  s.online && !snapshots[s.id] ? { ...snapshots, [s.id]: s } : snapshots;

// ---- Playlists -------------------------------------------------------------------------------

export type Playlist = { id: string; name: string; ids: string[] };
export type PlaylistStore = { lists: Playlist[]; online: Snapshots };
export const emptyPlaylists: PlaylistStore = { lists: [], online: {} };

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 60) || 'My playlist';

export function parsePlaylists(raw: string | null): PlaylistStore {
  if (!raw) return emptyPlaylists;
  try {
    const v = JSON.parse(raw);
    const lists: Playlist[] = (Array.isArray(v?.lists) ? v.lists : [])
      .filter((p: any) => p && typeof p.id === 'string' && Array.isArray(p.ids))
      .map((p: any) => ({ id: p.id, name: cleanName(String(p.name ?? '')), ids: [...new Set<string>(p.ids.filter((x: unknown) => typeof x === 'string'))] }));
    return { lists, online: v?.online && typeof v.online === 'object' ? v.online : {} };
  } catch {
    return emptyPlaylists;
  }
}

const withLists = (store: PlaylistStore, lists: Playlist[]): PlaylistStore => ({
  lists,
  online: pruneSnapshots(store.online, lists.flatMap((p) => p.ids)),
});

export function createPlaylist(store: PlaylistStore, name: string, id: string, first?: Sound): PlaylistStore {
  const p: Playlist = { id, name: cleanName(name), ids: first ? [first.id] : [] };
  return { lists: [p, ...store.lists], online: first ? snapshotIfOnline(store.online, first) : store.online };
}

export const renamePlaylist = (store: PlaylistStore, id: string, name: string): PlaylistStore =>
  ({ ...store, lists: store.lists.map((p) => (p.id === id ? { ...p, name: cleanName(name) } : p)) });

export const deletePlaylist = (store: PlaylistStore, id: string): PlaylistStore =>
  withLists(store, store.lists.filter((p) => p.id !== id));

// Adds to the end; a song already in the playlist is left where it is.
export function addToPlaylist(store: PlaylistStore, id: string, s: Sound): PlaylistStore {
  const p = store.lists.find((x) => x.id === id);
  if (!p || p.ids.includes(s.id)) return store;
  return {
    lists: store.lists.map((x) => (x.id === id ? { ...x, ids: [...x.ids, s.id] } : x)),
    online: snapshotIfOnline(store.online, s),
  };
}

export const removeFromPlaylist = (store: PlaylistStore, id: string, soundId: string): PlaylistStore =>
  withLists(store, store.lists.map((p) => (p.id === id ? { ...p, ids: p.ids.filter((x) => x !== soundId) } : p)));

// ---- Play history ----------------------------------------------------------------------------

export const MAX_RECENT = 30;
export type PlayStats = { recent: string[]; counts: Record<string, number>; online: Snapshots };
export const emptyStats: PlayStats = { recent: [], counts: {}, online: {} };

export function parseStats(raw: string | null): PlayStats {
  if (!raw) return emptyStats;
  try {
    const v = JSON.parse(raw);
    return {
      recent: Array.isArray(v?.recent) ? v.recent.filter((x: unknown) => typeof x === 'string').slice(0, MAX_RECENT) : [],
      counts: v?.counts && typeof v.counts === 'object' ? v.counts : {},
      online: v?.online && typeof v.online === 'object' ? v.online : {},
    };
  } catch {
    return emptyStats;
  }
}

export function recordPlay(stats: PlayStats, s: Sound): PlayStats {
  const recent = [s.id, ...stats.recent.filter((x) => x !== s.id)].slice(0, MAX_RECENT);
  const counts = { ...stats.counts, [s.id]: (stats.counts[s.id] ?? 0) + 1 };
  // only online songs still listed somewhere need their copy
  const online = pruneSnapshots(snapshotIfOnline(stats.online, s), recent);
  return { recent, counts, online };
}

// Most played ids, highest first (ties: the more recently played first), at least `min` plays.
export function topPlayed(stats: PlayStats, n: number, min = 2): string[] {
  const rank = new Map(stats.recent.map((id, i) => [id, i]));
  return Object.entries(stats.counts)
    .filter(([, c]) => c >= min)
    .sort(([a, ca], [b, cb]) => cb - ca || (rank.get(a) ?? 1e9) - (rank.get(b) ?? 1e9))
    .slice(0, n)
    .map(([id]) => id);
}

export const forgetSound = (stats: PlayStats, id: string): PlayStats => {
  const { [id]: _, ...counts } = stats.counts;
  const recent = stats.recent.filter((x) => x !== id);
  return { recent, counts, online: pruneSnapshots(stats.online, recent) };
};

// ---- Artists / albums ------------------------------------------------------------------------

export type Group = { name: string; sounds: Sound[] };

// Songs grouped by their artist or album tag, A-Z. Songs without the tag are left out. Names that
// differ only in case or spacing are one group.
export function groupBy(sounds: Sound[], key: 'artist' | 'album'): Group[] {
  const groups = new Map<string, Group>();
  for (const s of sounds) {
    const name = s[key]?.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const k = name.toLowerCase();
    const g = groups.get(k);
    if (g) g.sounds.push(s);
    else groups.set(k, { name, sounds: [s] });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
