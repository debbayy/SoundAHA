import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseReady } from '../lib/supabase';
import { cleanCatalog, isFresh, parseSaved } from '../lib/catalog';
import { Sound } from '../types';
import { SEED } from './seed';

const KEY = 'soundly.catalog';
// Optional static catalog (a JSON array of sound rows on a CDN such as Cloudflare R2 / Pages or
// GitHub Pages). When set, the list never touches Supabase at all.
const CATALOG_URL = process.env.EXPO_PUBLIC_CATALOG_URL ?? '';

// Loaded once per app run and shared by every tab. The server list is refreshed at most once a day
// (see lib/catalog.ts); until it has sounds, the built-in ones are used.
let cache: Sound[] | null = null;
let inflight: Promise<Sound[] | null> | null = null;

async function fetchRemote(): Promise<Sound[]> {
  if (CATALOG_URL) {
    const res = await fetch(CATALOG_URL);
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    return cleanCatalog(await res.json());
  }
  const { data, error } = await supabase
    .from('sounds')
    .select('id,title,category,audio_url,thumbnail_url,emoji,duration,is_featured')
    .order('is_featured', { ascending: false })
    .limit(500);
  if (error) throw error;
  return cleanCatalog(data);
}

async function load(): Promise<Sound[] | null> {
  const saved = parseSaved(await AsyncStorage.getItem(KEY).catch(() => null));
  if (isFresh(saved, Date.now())) return saved!.sounds;
  let sounds: Sound[];
  try {
    sounds = await fetchRemote();
  } catch (e) {
    console.warn('[catalog] fetch failed, keeping what we have', e);
    sounds = saved?.sounds ?? [];
  }
  // remembered for a day even when empty or failed: no retry storm on every launch
  AsyncStorage.setItem(KEY, JSON.stringify({ savedAt: Date.now(), sounds })).catch(() => {});
  return sounds;
}

export function useSounds() {
  const [sounds, setSounds] = useState<Sound[]>(cache ?? SEED);
  useEffect(() => {
    if (cache || (!supabaseReady && !CATALOG_URL)) return;
    let alive = true;
    (inflight ??= load().then((r) => (cache = r?.length ? r : SEED))).then((r) => { if (alive && r) setSounds(r); });
    return () => { alive = false; };
  }, []);
  return sounds;
}
