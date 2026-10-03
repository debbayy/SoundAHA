import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Sound } from '../types';

// mime type (Android) and UTI (iOS) per extension, so the share sheet offers apps that take audio
const TYPES: Record<string, { mime: string; uti: string }> = {
  mp3: { mime: 'audio/mpeg', uti: 'public.mp3' },
  m4a: { mime: 'audio/mp4', uti: 'public.mpeg-4-audio' },
  aac: { mime: 'audio/aac', uti: 'public.aac-audio' },
  wav: { mime: 'audio/wav', uti: 'com.microsoft.waveform-audio' },
  ogg: { mime: 'audio/ogg', uti: 'public.audio' },
  opus: { mime: 'audio/ogg', uti: 'public.audio' },
  flac: { mime: 'audio/flac', uti: 'public.audio' },
};

const extOf = (uri: string) => {
  const m = uri.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : 'mp3';
};

// "Artist - Title" without characters file systems / receiving apps choke on
const fileNameOf = (s: Sound) =>
  (s.artist ? `${s.artist} - ${s.title}` : s.title).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sound';

// A local file:// copy of the song, whatever its source: built-in asset, Supabase URL or an
// imported song. Named after the song, so the receiver doesn't get "local-1712345.mp3".
async function localCopy(s: Sound): Promise<File> {
  let src: string;
  if (s.audio_source) {
    const asset = Asset.fromModule(s.audio_source);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('asset not available');
    src = asset.localUri;
  } else {
    src = s.audio_url;
  }

  const dir = new Directory(Paths.cache, 'share');
  dir.create({ idempotent: true });
  const dest = new File(dir, `${fileNameOf(s)}.${extOf(src)}`);

  // Overwrite instead of "delete the folder, then write": the previous shared file can still be
  // held by the share sheet / AirDrop, so deleting it may fail and the write would then be refused
  // because the file already exists (sharing the same song a second time).
  if (/^https?:/i.test(src)) await File.downloadFileAsync(src, dest, { idempotent: true });
  else new File(src).copy(dest, { overwrite: true });

  // keep the cache small: drop earlier shared files, skipping any that are still in use
  for (const e of dir.list()) {
    if (e.uri !== dest.uri) { try { e.delete(); } catch { /* still in use, next time */ } }
  }
  return dest;
}

// Opens the system share sheet with the song file: AirDrop / Messages / WhatsApp... on iOS,
// Bluetooth / Quick Share / WhatsApp... on Android. Resolves once the sheet is closed.
export async function shareSound(s: Sound): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  const file = await localCopy(s);
  const type = TYPES[extOf(file.uri)] ?? { mime: 'audio/*', uti: 'public.audio' };
  await Sharing.shareAsync(file.uri, { mimeType: type.mime, UTI: type.uti, dialogTitle: `Share "${s.title}"` });
}
