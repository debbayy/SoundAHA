import { Sound } from '../types';
import { resolveIds } from './library';

// Favorites live on the phone first, so they work without an account and for every kind of sound.
// `ids` is newest first. Online (Freesound) results are not in any other list, so a copy of each
// favorited one is kept in `online`.
export type FavStore = { ids: string[]; online: Record<string, Sound> };
export const emptyFavs: FavStore = { ids: [], online: {} };

// Only sounds from the Supabase `sounds` table (uuid ids) can be synced to the account.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isSyncable = (id: string) => UUID.test(id);

export function parseFavs(raw: string | null): FavStore {
  if (!raw) return emptyFavs;
  try {
    const v = JSON.parse(raw);
    const ids = Array.isArray(v?.ids) ? v.ids.filter((x: unknown): x is string => typeof x === 'string') : [];
    const online = v?.online && typeof v.online === 'object' ? v.online : {};
    return { ids: [...new Set<string>(ids)], online };
  } catch {
    return emptyFavs;
  }
}

export function toggleFav(store: FavStore, sound: Sound): FavStore {
  if (store.ids.includes(sound.id)) {
    const { [sound.id]: _, ...online } = store.online;
    return { ids: store.ids.filter((x) => x !== sound.id), online };
  }
  return {
    ids: [sound.id, ...store.ids],
    online: sound.online ? { ...store.online, [sound.id]: sound } : store.online,
  };
}

// After login: favorites from the account are added to the phone's, and the phone's syncable
// favorites the account doesn't have yet are returned to be uploaded.
export function mergeRemote(store: FavStore, remoteIds: string[]): { store: FavStore; toUpload: string[] } {
  const have = new Set(store.ids);
  const added = remoteIds.filter((id) => !have.has(id));
  const remote = new Set(remoteIds);
  const toUpload = store.ids.filter((id) => isSyncable(id) && !remote.has(id));
  return { store: added.length ? { ...store, ids: [...store.ids, ...added] } : store, toUpload };
}

// The favorite songs, newest first, found in the given lists. Favorites whose song is gone (a
// deleted import, a sound removed from the server) are left out.
export const resolveFavs = (store: FavStore, lists: Sound[][]): Sound[] => resolveIds(store.ids, lists, store.online);
