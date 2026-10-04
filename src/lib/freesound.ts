import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sound } from '../types';

// Freesound.org search (https://freesound.org/docs/api/), through the "freesound-search" Edge Function
// (supabase/functions/freesound-search): the API key stays on the server and results are shared by
// all users. This phone also remembers its own recent searches for a week, so repeating one costs
// nothing at all.
const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const ENDPOINT = `${SUPABASE_URL}/functions/v1/freesound-search`;
export const freesoundReady = SUPABASE_URL.length > 0;

const SAVED_KEY = 'soundly.freesoundCache';
const SAVED_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SAVED = 40; // queries kept on the phone

type FsResult = {
  id: number;
  name: string;
  username: string;
  duration: number;
  license: string;
  previews: Record<string, string>;
};

// License URL -> short name shown next to the author (CC BY requires crediting them).
const licenseName = (url: string) => {
  if (url.includes('publicdomain/zero')) return 'CC0';
  if (url.includes('/by-nc/')) return 'CC BY-NC';
  if (url.includes('/sampling+/')) return 'Sampling+';
  if (url.includes('/by/')) return 'CC BY';
  return 'CC';
};

const titleOf = (name: string) => name.replace(/\.(wav|mp3|ogg|flac|aiff?|m4a)$/i, '').replace(/[_]+/g, ' ').trim() || 'Untitled';

const toSound = (r: FsResult): Sound => ({
  id: `fs-${r.id}`,
  title: titleOf(r.name),
  artist: r.username,
  credit: `${r.username} · ${licenseName(r.license)} · Freesound`,
  category: 'meme',
  emoji: '🌐',
  duration: Math.max(1, Math.round(r.duration)),
  audio_url: r.previews['preview-hq-mp3'] ?? r.previews['preview-lq-mp3'],
  online: true,
});

type Saved = Record<string, { at: number; list: Sound[] }>;
const memory = new Map<string, Sound[]>();
let saved: Saved | null = null;

const loadSaved = async (): Promise<Saved> => {
  if (saved) return saved;
  try { saved = JSON.parse((await AsyncStorage.getItem(SAVED_KEY)) ?? '{}') ?? {}; } catch { saved = {}; }
  return saved!;
};

const remember = async (q: string, list: Sound[]) => {
  const all = await loadSaved();
  all[q] = { at: Date.now(), list };
  const keep = Object.entries(all).sort(([, a], [, b]) => b.at - a.at).slice(0, MAX_SAVED);
  saved = Object.fromEntries(keep);
  AsyncStorage.setItem(SAVED_KEY, JSON.stringify(saved)).catch(() => {});
};

export async function searchFreesound(query: string, signal?: AbortSignal): Promise<Sound[]> {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
  if (!q || !freesoundReady) return [];
  const hit = memory.get(q);
  if (hit) return hit;
  const old = (await loadSaved())[q];
  if (old && Date.now() - old.at < SAVED_TTL_MS) {
    memory.set(q, old.list);
    return old.list;
  }

  const res = await fetch(`${ENDPOINT}?${new URLSearchParams({ q })}`, { signal, headers: ANON_KEY ? { apikey: ANON_KEY } : undefined });
  if (res.status === 429) throw new Error('rate-limited');
  if (!res.ok) throw new Error(`freesound ${res.status}`);
  const json: { results?: FsResult[] } = await res.json();
  const list = (json.results ?? []).filter((r) => r.previews).map(toSound).filter((x) => x.audio_url);
  memory.set(q, list);
  remember(q, list);
  return list;
}
