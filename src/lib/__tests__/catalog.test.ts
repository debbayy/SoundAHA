import { CATALOG_TTL_MS, cleanCatalog, isFresh, parseSaved } from '../catalog';

describe('catalog cache', () => {
  it('is fresh for a day', () => {
    expect(isFresh(null, 1000)).toBe(false);
    expect(isFresh({ savedAt: 0, sounds: [] }, CATALOG_TTL_MS - 1)).toBe(true);
    expect(isFresh({ savedAt: 0, sounds: [] }, CATALOG_TTL_MS)).toBe(false);
    expect(isFresh({ savedAt: 5000, sounds: [] }, 1000)).toBe(false); // clock went back: refresh
  });

  it('keeps only well-formed https sounds, featured first', () => {
    const out = cleanCatalog([
      { id: 'a', title: 'A', category: 'music', audio_url: 'https://cdn/a.mp3', duration: 3.6 },
      { id: 'b', title: 'B', category: 'weird', audio_url: 'https://cdn/b.mp3', is_featured: true },
      { id: 'c', title: 'C', audio_url: 'http://insecure/c.mp3' },
      { title: 'no id', audio_url: 'https://x' },
      null,
    ]);
    expect(out.map((s) => s.id)).toEqual(['b', 'a']);
    expect(out[0].category).toBe('meme');
    expect(out[1].duration).toBe(4);
    expect(cleanCatalog('nope')).toEqual([]);
  });

  it('parses what was saved', () => {
    expect(parseSaved(null)).toBeNull();
    expect(parseSaved('{oops')).toBeNull();
    expect(parseSaved(JSON.stringify({ savedAt: 5, sounds: [] }))).toEqual({ savedAt: 5, sounds: [] });
  });
});

describe('audio cache names', () => {
  // expo-file-system is native; only the pure naming is tested here
  jest.mock('expo-file-system', () => ({}));
  const { cacheName, isRemote } = require('../audioCache');

  it('only caches internet files', () => {
    expect(isRemote('https://cdn/a.mp3')).toBe(true);
    expect(isRemote('file:///doc/a.mp3')).toBe(false);
  });

  it('names files stably and keeps the extension', () => {
    expect(cacheName('https://cdn/a.m4a?token=1')).toMatch(/^[a-z0-9]+\.m4a$/);
    expect(cacheName('https://cdn/a.m4a?token=1')).toBe(cacheName('https://cdn/a.m4a?token=1'));
    expect(cacheName('https://cdn/stream')).toMatch(/\.mp3$/);
  });
});
