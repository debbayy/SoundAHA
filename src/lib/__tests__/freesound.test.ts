type Module = typeof import('../freesound');

// The API key is read when the module loads, so each test loads a fresh copy with its own env.
const load = (key: string | undefined): Module => {
  if (key === undefined) delete process.env.EXPO_PUBLIC_FREESOUND_KEY;
  else process.env.EXPO_PUBLIC_FREESOUND_KEY = key;
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

afterEach(() => { jest.restoreAllMocks(); });

describe('searchFreesound', () => {
  it('does nothing without an API key', async () => {
    const fetchMock = (globalThis.fetch = respond(200));
    const fs = load(undefined);
    expect(fs.freesoundReady).toBe(false);
    expect(await fs.searchFreesound('boom')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores blank queries', async () => {
    const fetchMock = (globalThis.fetch = respond(200));
    expect(await load('k').searchFreesound('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps results to sounds', async () => {
    globalThis.fetch = respond(200, { results: [result()] });
    const [s] = await load('k').searchFreesound('Boom');
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
    const list = await load('k').searchFreesound('x');
    expect(list.map((s) => s.id)).toEqual(['fs-1', 'fs-2']);
    expect(list[0].credit).toContain('CC0');
    expect(list[1].credit).toContain('CC BY-NC');
    expect(list[1].audio_url).toBe('lq');
  });

  it('caches results per normalized query', async () => {
    const fetchMock = (globalThis.fetch = respond(200, { results: [result()] }));
    const fs = load('k');
    await fs.searchFreesound('Boom');
    await fs.searchFreesound('  boom ');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('query')).toBe('boom');
    expect(url.searchParams.get('token')).toBe('k');
  });

  it('throws on rate limit and other errors', async () => {
    globalThis.fetch = respond(429);
    await expect(load('k').searchFreesound('a')).rejects.toThrow('rate-limited');
    globalThis.fetch = respond(500);
    await expect(load('k').searchFreesound('b')).rejects.toThrow('freesound 500');
  });
});
