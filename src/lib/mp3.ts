import { File } from 'expo-file-system';

// Last readable segment of a file/folder URI. Handles Android "content://" URIs, where the name is
// percent-encoded and sits behind a document id such as "primary:Music/My Album/song.mp3".
export function nameFromUri(uri: string): string {
  let s = uri.replace(/\/+$/, '');
  const slash = s.lastIndexOf('/');
  if (slash >= 0) s = s.slice(slash + 1);
  try { s = decodeURIComponent(s); } catch { /* keep as is */ }
  const cut = Math.max(s.lastIndexOf('/'), s.lastIndexOf(':'));
  return cut >= 0 ? s.slice(cut + 1) : s;
}

export const hasMp3Name = (name: string) => /\.mp3$/i.test(name.trim());

// The name ends in an extension that is not .mp3 (".m4a", ".jpg"...). A name with no extension at
// all is not "other": such a file is judged by its contents instead.
export const hasOtherExtension = (name: string) => /\.[a-z0-9]{1,5}$/i.test(name.trim()) && !hasMp3Name(name);

// Only .mp3 is accepted. The extension alone is not trusted (a renamed file would slip through), so
// the first bytes are checked too: an ID3 tag ("ID3") or an MPEG audio frame sync (11 set bits).
export function looksLikeMp3(uri: string): boolean {
  let handle: ReturnType<File['open']> | null = null;
  try {
    handle = new File(uri).open();
    const b = handle.readBytes(3);
    if (b.length < 3) return false;
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true; // "ID3"
    return b[0] === 0xff && (b[1] & 0xe0) === 0xe0; // frame sync
  } catch {
    // The file could not be opened to look inside. That says nothing against it being an mp3, so do
    // not turn a good song away just because the check itself failed.
    return true;
  } finally {
    try { handle?.close(); } catch { /* ignore */ }
  }
}
