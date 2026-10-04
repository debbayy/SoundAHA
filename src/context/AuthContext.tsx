import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, supabaseReady } from '../lib/supabase';

type Ctx = { session: Session | null };
const AuthCtx = createContext<Ctx>({ session: null });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabaseReady) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={{ session }}>{children}</AuthCtx.Provider>;
}
