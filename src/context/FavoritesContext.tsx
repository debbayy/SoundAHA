import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sound } from '../types';
import { supabase } from '../lib/supabase';
import { emptyFavs, FavStore, isSyncable, mergeRemote, parseFavs, toggleFav as toggleIn } from '../lib/favorites';
import { useAuth } from './AuthContext';

const KEY = 'soundly.favorites';

type Ctx = {
  favs: FavStore;
  isFav: (id: string) => boolean;
  toggleFav: (s: Sound) => void;
};
const FavCtx = createContext<Ctx>({ favs: emptyFavs, isFav: () => false, toggleFav: () => {} });
export const useFavorites = () => useContext(FavCtx);

// Favorites are saved on the phone and work without an account. When logged in, favorites of
// server sounds are also kept in the Supabase `favorites` table so they follow the account.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [favs, setFavs] = useState<FavStore>(emptyFavs);
  const [loaded, setLoaded] = useState(false);
  const favsRef = useRef(favs);

  const save = (next: FavStore) => {
    favsRef.current = next;
    setFavs(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { const v = parseFavs(raw); favsRef.current = v; setFavs(v); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Logged in: bring the account's favorites onto the phone and upload the phone's missing ones.
  const userId = session?.user.id;
  useEffect(() => {
    if (!loaded || !userId) return;
    let cancelled = false;
    supabase.from('favorites').select('sound_id').then(({ data, error }) => {
      if (cancelled || error) return;
      const { store, toUpload } = mergeRemote(favsRef.current, (data ?? []).map((r) => r.sound_id));
      if (store !== favsRef.current) save(store);
      if (toUpload.length) {
        supabase.from('favorites').insert(toUpload.map((sound_id) => ({ sound_id, user_id: userId })))
          .then(({ error: e }) => { if (e) console.warn('[favorites] upload failed', e.message); });
      }
    });
    return () => { cancelled = true; };
  }, [loaded, userId]);

  const toggleFav = useCallback((s: Sound) => {
    const wasOn = favsRef.current.ids.includes(s.id);
    save(toggleIn(favsRef.current, s));
    if (!userId || !isSyncable(s.id)) return;
    const q = wasOn
      ? supabase.from('favorites').delete().eq('sound_id', s.id).eq('user_id', userId)
      : supabase.from('favorites').insert({ sound_id: s.id, user_id: userId });
    q.then(({ error }) => { if (error) console.warn('[favorites] sync failed', error.message); });
  }, [userId]);

  const value = useMemo(() => {
    const set = new Set(favs.ids);
    return { favs, isFav: (id: string) => set.has(id), toggleFav };
  }, [favs, toggleFav]);

  return <FavCtx.Provider value={value}>{children}</FavCtx.Provider>;
}
