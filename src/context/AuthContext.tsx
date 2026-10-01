import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '../lib/supabase';

type Ctx = {
  session: Session | null;
  favs: string[];
  /** returns false when the user must log in first */
  toggleFav: (soundId: string) => Promise<boolean>;
};
const AuthCtx = createContext<Ctx>({ session: null, favs: [], toggleFav: async () => false });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => {
    if (!supabaseReady) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setFavs([]); return; }
    supabase.from('favorites').select('sound_id').then(({ data }) => setFavs((data ?? []).map((r) => r.sound_id)));
  }, [session]);

  const toggleFav = async (id: string) => {
    if (!session) return false;
    const on = favs.includes(id);
    setFavs((f) => (on ? f.filter((x) => x !== id) : [...f, id]));
    if (on) await supabase.from('favorites').delete().eq('sound_id', id).eq('user_id', session.user.id);
    else await supabase.from('favorites').insert({ sound_id: id, user_id: session.user.id });
    return true;
  };

  return <AuthCtx.Provider value={{ session, favs, toggleFav }}>{children}</AuthCtx.Provider>;
}
