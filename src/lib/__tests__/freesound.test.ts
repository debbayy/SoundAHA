jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

type Module = typeof import('../freesound');

// The endpoint is read when the module loads, so each test loads a fresh copy with its own env
// (and a fresh in-memory cache).
const load = (supabaseUrl: string | undefined): Module => {
  if (supabaseUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = supabaseUrl;
  let mod!: Module;
  jest.isolateModules(() => { mod = require('../freesound'); });
  return mod;
};

const result = (over: Record<string, unknown> = {}) => ({
  id: 42,
  name: 'vine_boom.wav',
  username: 'alice',
  duration: 1.4,
  license: 'http://creativecommons.org/licenses/by/4.0/',
  previews: { 'preview-hq-mp3': 'https://cdn/hq.mp3', 'preview-lq-mp3': 'https://cdn/lq.mp3' },
  ...over,
});

const respond = (status: number, body: unknown = {}) =>
  jest.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300, json: async () => body });

const AsyncStorage = require('@react-native-async-storage/async-storage');
beforeEach(async () => { await AsyncStorage.clear(); });
afterEach(() => { jest.restoreAllMocks(); });

describe('searchFreesound', () => {
  it('does nothing without a server', async () => {
    const fetchMock = (globalThis.fetch = respond(200));
    const fs = load(undefined);
    expect(fs.freesoundReady).toBe(false);
    expect(await fs.searchFreesound('boom')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores blank queries', async () => {
    const fetchMock = (globalThis.fetch = respond(200));
    expect(await load('https://p.supabase.co').searchFreesound('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the server function, never Freesound with a key', async () => {
    const fetchMock = (globalThis.fetch = respond(200, { results: [result()] }));
    await load('https://p.supabase.co/').searchFreesound('  Vine   Boom ');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe('https://p.supabase.co/functions/v1/freesound-search');
    expect(url.searchParams.get('q')).toBe('vine boom');
    expect(url.searchParams.has('token')).toBe(false);
  });

  it('maps results to sounds', async () => {
    globalThis.fetch = respond(200, { results: [result()] });
    const [s] = await load('https://p.supabase.co').searchFreesound('Boom');
    expect(s).toEqual({
      id: 'fs-42',
      title: 'vine boom',
      artist: 'alice',
      credit: 'alice · CC BY · Freesound',
      category: 'meme',
      emoji: '🌐',
      duration: 1,
      audio_url: 'https://cdn/hq.mp3',
      online: true,
    });
  });

  it('names licenses and falls back to the low-quality preview', async () => {
    globalThis.fetch = respond(200, {
      results: [
        result({ id: 1, license: 'http://creativecommons.org/publicdomain/zero/1.0/' }),
        result({ id: 2, license: 'http://creativecommons.org/licenses/by-nc/4.0/', previews: { 'preview-lq-mp3': 'lq' } }),
        result({ id: 3, previews: {} }),
      ],
    });
    const list = await load('https://p.supabase.co').searchFreesound('x');
    expect(list.map((s) => s.id)).toEqual(['fs-1', 'fs-2']);
    expect(list[0].credit).toContain('CC0');
    expect(list[1].credit).toContain('CC BY-NC');
    expect(list[1].audio_url).toBe('lq');
  });

  it('remembers searches: in memory, and on the phone across app runs', async () => {
    const fetchMock = (globalThis.fetch = respond(200, { results: [result()] }));
    const fs = load('https://p.supabase.co');
    await fs.searchFreesound('Boom');
    await fs.searchFreesound('  boom ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 0)); // let the save finish
    const again = load('https://p.supabase.co'); // a new app run: memory is empty
    expect((await again.searchFreesound('boom')).map((s) => s.id)).toEqual(['fs-42']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws on rate limit and other errors', async () => {
    globalThis.fetch = respond(429);
    await expect(load('https://p.supabase.co').searchFreesound('a')).rejects.toThrow('rate-limited');
    globalThis.fetch = respond(500);
    await expect(load('https://p.supabase.co').searchFreesound('b')).rejects.toThrow('freesound 500');
  });
});

describe('licenseAllowed', () => {
  const { licenseAllowed } = load('https://p.supabase.co');
  it('keeps everything by default, drops NonCommercial when the app is commercial', () => {
    const nc = 'http://creativecommons.org/licenses/by-nc/4.0/';
    const by = 'http://creativecommons.org/licenses/by/4.0/';
    expect(licenseAllowed(nc, false)).toBe(true);
    expect(licenseAllowed(nc, true)).toBe(false);
    expect(licenseAllowed(by, true)).toBe(true);
    expect(licenseAllowed('http://creativecommons.org/publicdomain/zero/1.0/', true)).toBe(true);
  });
});
