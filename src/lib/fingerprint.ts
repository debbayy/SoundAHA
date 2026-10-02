import { File } from 'expo-file-system';

const CHUNK = 64 * 1024;

const fnv = (hash: number, bytes: Uint8Array) => {
  let h = hash;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
};

// Cheap identity for an audio file: its size plus a hash of the first and last 64 KB. Two copies
// of the same song get the same value even if they have different names. null if unreadable.
export function fingerprintFile(uri: string): string | null {
  let handle: ReturnType<File['open']> | null = null;
  try {
    handle = new File(uri).open();
    const size = handle.size ?? 0;
    if (size <= 0) return null;
    let h = fnv(2166136261, handle.readBytes(Math.min(size, CHUNK)));
    if (size > CHUNK * 2) {
      handle.offset = size - CHUNK;
      h = fnv(h, handle.readBytes(CHUNK));
    }
    return `${size}-${h.toString(16)}`;
  } catch {
    return null;
  } finally {
    try { handle?.close(); } catch { /* ignore */ }
  }
}
