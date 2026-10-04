import { Sound } from '../types';

// The server sound list is fetched at most once a day and kept on the phone, so a million users
// opening the app don't each hit the server (Supabase's free plan has 5 GB of egress a month).
// A failed or empty fetch is remembered too, so a missing table / a limited project isn't retried on
// every launch.
export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
export type SavedCatalog = { savedAt: number; sounds: Sound[] };

export const isFresh = (saved: SavedCatalog | null, now: number, ttl = CATALOG_TTL_MS) =>
  !!saved && now - saved.savedAt >= 0 && now - saved.savedAt < ttl;

const CATEGORIES = new Set(['meme', 'music', 'trending']);

// Rows from the server or a static catalog file, keeping only well-formed sounds.
export function cleanCatalog(rows: unknown): Sound[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r: any) => r && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.audio_url === 'string' && /^https:\/\//i.test(r.audio_url))
    .map((r: any): Sound => ({
      id: r.id,
      title: r.title,
      category: CATEGORIES.has(r.category) ? r.category : 'meme',
      audio_url: r.audio_url,
      thumbnail_url: typeof r.thumbnail_url === 'string' ? r.thumbnail_url : null,
      emoji: typeof r.emoji === 'string' ? r.emoji : undefined,
      duration: Number.isFinite(r.duration) ? Math.max(0, Math.round(r.duration)) : 0,
      is_featured: !!r.is_featured,
    }))
    .sort((a, b) => Number(!!b.is_featured) - Number(!!a.is_featured));
}

export function parseSaved(raw: string | null): SavedCatalog | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.savedAt === 'number' ? { savedAt: v.savedAt, sounds: cleanCatalog(v.sounds) } : null;
  } catch {
    return null;
  }
}
