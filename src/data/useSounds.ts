import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { Sound } from '../types';
import { SEED } from './seed';

export function useSounds() {
  const [sounds, setSounds] = useState<Sound[]>(SEED);
  useEffect(() => {
    if (!supabaseReady) return;
    supabase
      .from('sounds')
      .select('*')
      .order('is_featured', { ascending: false })
      .then(({ data }) => data?.length && setSounds(data as Sound[]));
  }, []);
  return sounds;
}
