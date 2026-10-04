import { id3TagSize, parseId3 } from '../id3';

const latin1 = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const syncsafe = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];

// ID3v2.3 frame: 4-byte id, 4-byte big-endian size, 2 flag bytes, body.
const frame23 = (id: string, body: number[]) => [...latin1(id), ...be32(body.length), 0, 0, ...body];
const tag = (version: number, frames: number[], flags = 0) =>
  Uint8Array.from([...latin1('ID3'), version, 0, flags, ...syncsafe(frames.length), ...frames]);

describe('id3TagSize', () => {
  it('returns 0 when there is no ID3 header', () => {
    expect(id3TagSize(Uint8Array.from(latin1('RIFF......')))).toBe(0);
    expect(id3TagSize(new Uint8Array(4))).toBe(0);
  });

  it('decodes the syncsafe size and adds the 10-byte header', () => {
    expect(id3TagSize(tag(3, new Array(300).fill(0)))).toBe(310);
  });
});

describe('parseId3', () => {
  it('returns an empty object for non-ID3 input', () => {
    expect(parseId3(new Uint8Array(20))).toEqual({});
  });

  it('reads latin-1 text frames from ID3v2.3', () => {
    const meta = parseId3(tag(3, [
      ...frame23('TIT2', [0, ...latin1('Bruh')]),
      ...frame23('TPE1', [0, ...latin1('Meme Lord')]),
      ...frame23('TALB', [0, ...latin1('Classics')]),
    ]));
    expect(meta).toEqual({ title: 'Bruh', artist: 'Meme Lord', album: 'Classics' });
  });

  it('reads UTF-16 text with a BOM', () => {
    const utf16le = [0xff, 0xfe, ...Array.from('Héllo').flatMap((c) => [c.charCodeAt(0), 0])];
    expect(parseId3(tag(3, frame23('TIT2', [1, ...utf16le]))).title).toBe('Héllo');
  });

  it('reads UTF-8 text', () => {
    const utf8 = Array.from(new TextEncoder().encode('Lagu 🎵'));
    expect(parseId3(tag(3, frame23('TIT2', [3, ...utf8]))).title).toBe('Lagu 🎵');
  });

  it('reads ID3v2.2 three-letter frames', () => {
    const frame22 = (id: string, body: number[]) => [...latin1(id), 0, 0, body.length, ...body];
    const meta = parseId3(tag(2, [...frame22('TT2', [0, ...latin1('Old')]), ...frame22('TP1', [0, ...latin1('Tagger')])]));
    expect(meta).toEqual({ title: 'Old', artist: 'Tagger' });
  });

  it('extracts the cover and sniffs the real mime type', () => {
    const png = [0x89, 0x50, 0x4e, 0x47, ...new Array(20).fill(7)];
    // mime says jpeg, data is png
    const apic = [0, ...latin1('image/jpeg'), 0, 3, ...latin1('cover'), 0, ...png];
    const meta = parseId3(tag(3, frame23('APIC', apic)));
    expect(meta.cover?.mime).toBe('image/png');
    expect(Array.from(meta.cover!.data)).toEqual(png);
  });

  it('stops at padding and ignores frames that run past the tag', () => {
    const frames = [...frame23('TIT2', [0, ...latin1('Ok')]), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(parseId3(tag(3, frames))).toEqual({ title: 'Ok' });

    const broken = [...latin1('TIT2'), ...be32(999), 0, 0, 0, ...latin1('x')];
    expect(parseId3(tag(3, broken))).toEqual({});
  });
});
