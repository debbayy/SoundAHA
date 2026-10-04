import { Directory, File, Paths } from 'expo-file-system';
import { hash } from './party';

// Songs streamed from the internet are saved on the phone the first time they play, and play from
// that copy afterwards: replays cost no bandwidth (ours or the user's). It lives in the cache folder,
// which Android empties by itself when storage runs low.

export const isRemote = (url: string) => /^https?:\/\//i.test(url);

// File name for a URL: stable, and keeps the extension so the player recognizes the format.
export function cacheName(url: string): string {
  const ext = url.split('?')[0].match(/\.([a-z0-9]{2,4})$/i)?.[1]?.toLowerCase() ?? 'mp3';
  return `${hash(url)}.${ext}`;
}

const dir = () => {
  const d = new Directory(Paths.cache, 'audio');
  d.create({ idempotent: true, intermediates: true });
  return d;
};

// The saved copy of `url`, or null if it hasn't been saved yet.
export function cachedUri(url: string): string | null {
  if (!isRemote(url)) return null;
  try {
    const f = new File(dir(), cacheName(url));
    return f.exists ? f.uri : null;
  } catch {
    return null;
  }
}

const pending = new Set<string>();

// Save `url` for next time, without holding up playback. Downloads into a temporary name first, so
// an app closed mid-download never leaves a cut-off song behind.
export function cacheInBackground(url: string) {
  if (!isRemote(url) || pending.has(url) || cachedUri(url)) return;
  pending.add(url);
  (async () => {
    const d = dir();
    const name = cacheName(url);
    const part = new File(d, `${name}.part`);
    try {
      if (part.exists) part.delete();
      await File.downloadFileAsync(url, part, { idempotent: true });
      part.move(new File(d, name));
    } catch {
      try { if (part.exists) part.delete(); } catch { /* ignore */ }
    } finally {
      pending.delete(url);
    }
  })();
}
