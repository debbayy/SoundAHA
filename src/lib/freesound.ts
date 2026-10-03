import { Sound } from '../types';

// Freesound.org search (https://freesound.org/docs/api/). A token is enough for search results and
// their MP3 previews. Limits: 60 requests / minute, 2000 / day, so results are cached per query.
const KEY = process.env.EXPO_PUBLIC_FREESOUND_KEY ?? '';
export const freesoundReady = KEY.length > 0;

const API = 'https://freesound.org/apiv2/search/';
const FIELDS = 'id,name,username,duration,license,previews';
const MAX_SECONDS = 30; // meme sounds are short; this also keeps out hour-long field recordings

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

const cache = new Map<string, Sound[]>();

export async function searchFreesound(query: string, signal?: AbortSignal): Promise<Sound[]> {
  const q = query.trim().toLowerCase();
  if (!q || !freesoundReady) return [];
  const hit = cache.get(q);
  if (hit) return hit;
  const params = new URLSearchParams({
    query: q,
    filter: `duration:[0 TO ${MAX_SECONDS}]`,
    fields: FIELDS,
    page_size: '30',
    token: KEY,
  });
  const res = await fetch(`${API}?${params}`, { signal });
  if (res.status === 429) throw new Error('rate-limited');
  if (!res.ok) throw new Error(`freesound ${res.status}`);
  const json: { results: FsResult[] } = await res.json();
  const list = json.results.filter((r) => r.previews).map(toSound).filter((x) => x.audio_url);
  cache.set(q, list);
  return list;
}
