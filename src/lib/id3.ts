// Minimal ID3v2 reader (MP3 tags): title, artist, album and the embedded cover picture.
// Supports ID3v2.2, v2.3 and v2.4. Other tag formats (m4a, flac...) are not handled.

export type Id3Meta = {
  title?: string;
  artist?: string;
  album?: string;
  cover?: { mime: string; data: Uint8Array };
};

const syncsafe = (b: Uint8Array, o: number) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const be32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const be24 = (b: Uint8Array, o: number) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];

// Total size (header + body) of the ID3v2 tag at the start of a file, from its first 10 bytes. 0 if none.
export function id3TagSize(header: Uint8Array): number {
  if (header.length < 10 || header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) return 0; // "ID3"
  return syncsafe(header, 6) + 10;
}

function decode(bytes: Uint8Array, enc: number): string {
  if (!bytes.length) return '';
  let out = '';
  if (enc === 0) {
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]); // latin-1
  } else if (enc === 3) {
    try { out = decodeURIComponent(escape(String.fromCharCode(...bytes))); } catch { out = String.fromCharCode(...bytes); }
  } else {
    // UTF-16, with or without BOM
    let i = 0;
    let le = enc === 1 ? true : false;
    if (enc === 1 && bytes.length >= 2) {
      if (bytes[0] === 0xff && bytes[1] === 0xfe) { le = true; i = 2; }
      else if (bytes[0] === 0xfe && bytes[1] === 0xff) { le = false; i = 2; }
    }
    for (; i + 1 < bytes.length; i += 2) out += String.fromCharCode(le ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
  }
  return out.replace(/\u0000/g, '').trim();
}

// Index of the string terminator for the given encoding (1 byte for 0/3, 2 bytes for 1/2); -1 if missing.
function terminator(b: Uint8Array, from: number, enc: number): number {
  if (enc === 0 || enc === 3) {
    for (let i = from; i < b.length; i++) if (b[i] === 0) return i;
  } else {
    for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i;
  }
  return -1;
}

function text(frame: Uint8Array): string {
  return decode(frame.subarray(1), frame[0]);
}

function picture(frame: Uint8Array, v22: boolean): Id3Meta['cover'] | undefined {
  const enc = frame[0];
  let o = 1;
  let mime: string;
  if (v22) {
    mime = decode(frame.subarray(1, 4), 0).toLowerCase() === 'png' ? 'image/png' : 'image/jpeg';
    o = 4;
  } else {
    const end = terminator(frame, 1, 0);
    if (end < 0) return undefined;
    mime = decode(frame.subarray(1, end), 0).toLowerCase() || 'image/jpeg';
    o = end + 1;
  }
  o += 1; // picture type
  const d = terminator(frame, o, enc);
  if (d < 0) return undefined;
  o = d + (enc === 0 || enc === 3 ? 1 : 2);
  const data = frame.subarray(o);
  if (data.length < 16) return undefined;
  // Some taggers write a wrong mime; sniff the real one from the magic bytes.
  if (data[0] === 0x89 && data[1] === 0x50) mime = 'image/png';
  else if (data[0] === 0xff && data[1] === 0xd8) mime = 'image/jpeg';
  return { mime, data };
}

export function parseId3(input: Uint8Array): Id3Meta {
  const meta: Id3Meta = {};
  if (input.length < 10 || id3TagSize(input) === 0) return meta;
  const version = input[3]; // 2, 3 or 4
  const flags = input[5];
  const tagEnd = Math.min(input.length, id3TagSize(input));
  let body = input.subarray(10, tagEnd);

  if (flags & 0x80 && version < 4) {
    // tag-wide unsynchronisation: drop the 0x00 that follows every 0xFF
    const out: number[] = [];
    for (let i = 0; i < body.length; i++) {
      out.push(body[i]);
      if (body[i] === 0xff && body[i + 1] === 0x00) i++;
    }
    body = Uint8Array.from(out);
  }

  let o = 0;
  if (flags & 0x40 && version >= 3 && body.length >= 4) o = version === 4 ? syncsafe(body, 0) : be32(body, 0) + 4; // extended header

  const v22 = version === 2;
  const idLen = v22 ? 3 : 4;
  const headLen = v22 ? 6 : 10;
  while (o + headLen <= body.length) {
    if (body[o] === 0) break; // padding
    const id = String.fromCharCode(...body.subarray(o, o + idLen));
    const size = v22 ? be24(body, o + 3) : version === 4 ? syncsafe(body, o + 4) : be32(body, o + 4);
    const start = o + headLen;
    if (size <= 0 || start + size > body.length) break;
    const frame = body.subarray(start, start + size);
    o = start + size;

    if (id === 'TIT2' || id === 'TT2') meta.title = text(frame) || meta.title;
    else if (id === 'TPE1' || id === 'TP1') meta.artist = text(frame) || meta.artist;
    else if (id === 'TALB' || id === 'TAL') meta.album = text(frame) || meta.album;
    else if ((id === 'APIC' || id === 'PIC') && !meta.cover) meta.cover = picture(frame, v22);
  }
  return meta;
}
