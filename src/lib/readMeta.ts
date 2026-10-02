import { Directory, File, Paths } from 'expo-file-system';
import { id3TagSize, parseId3 } from './id3';

export type LocalMeta = { title?: string; artist?: string; album?: string; cover_url?: string };

const MAX_TAG = 12 * 1024 * 1024; // don't read absurdly large tags into memory

// Reads the title/artist/cover tags of an audio file in the app's storage. The cover (if any) is
// saved next to the song as its own image file so <Image> can show it. Returns {} when there is
// no readable tag; never throws.
export function readLocalMeta(uri: string, id: string): LocalMeta {
  let handle: ReturnType<File['open']> | null = null;
  try {
    const file = new File(uri);
    handle = file.open();
    const head = handle.readBytes(10);
    const total = Math.min(id3TagSize(head), MAX_TAG);
    if (!total) return {};
    handle.offset = 0;
    const meta = parseId3(handle.readBytes(total));

    let cover_url: string | undefined;
    if (meta.cover) {
      const dir = new Directory(Paths.document, 'covers');
      dir.create({ idempotent: true });
      const ext = meta.cover.mime === 'image/png' ? 'png' : 'jpg';
      const out = new File(dir, `${id}.${ext}`);
      out.write(meta.cover.data);
      cover_url = out.uri;
    }
    return { title: meta.title, artist: meta.artist, album: meta.album, cover_url };
  } catch {
    return {};
  } finally {
    try { handle?.close(); } catch { /* ignore */ }
  }
}
