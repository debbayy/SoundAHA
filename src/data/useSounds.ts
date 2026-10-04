import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase';
import { Sound } from '../types';
import { SEED } from './seed';

// Fetched once per app run and shared by every tab, so opening a tab neither re-queries Supabase nor
// re-renders its whole list when the seed sounds get swapped for the server ones.
let cache: Sound[] | null = null;
let inflight: Promise<Sound[] | null> | null = null;

const load = () =>
  (inflight ??= Promise.resolve(
    supabase.from('sounds').select('*').order('is_featured', { ascending: false })
  ).then(({ data }) => {
    if (data?.length) cache = data as Sound[];
    else inflight = null; // nothing yet: try again on the next mount
    return cache;
  }, () => { inflight = null; return null; }));

export function useSounds() {
  const [sounds, setSounds] = useState<Sound[]>(cache ?? SEED);
  useEffect(() => {
    if (!supabaseReady || cache) return;
    let alive = true;
    load().then((r) => { if (alive && r) setSounds(r); });
    return () => { alive = false; };
  }, []);
  return sounds;
}
