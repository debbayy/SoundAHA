import { emptyFavs, isSyncable, mergeRemote, parseFavs, resolveFavs, toggleFav } from '../favorites';
import { Sound } from '../../types';

const UUID_A = '11111111-2222-3333-4444-555555555555';
const UUID_B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const s = (id: string, extra: Partial<Sound> = {}): Sound => ({ id, title: id, category: 'meme', audio_url: 'u', duration: 1, ...extra });

describe('favorites', () => {
  it('only syncs server (uuid) ids', () => {
    expect(isSyncable(UUID_A)).toBe(true);
    expect(isSyncable('1')).toBe(false);
    expect(isSyncable('local-123')).toBe(false);
    expect(isSyncable('fs-42')).toBe(false);
  });

  it('toggles on (newest first) and off', () => {
    let f = toggleFav(emptyFavs, s('a'));
    f = toggleFav(f, s('b'));
    expect(f.ids).toEqual(['b', 'a']);
    f = toggleFav(f, s('a'));
    expect(f.ids).toEqual(['b']);
  });

  it('keeps a copy of online sounds and drops it when unfavorited', () => {
    const online = s('fs-1', { online: true });
    let f = toggleFav(emptyFavs, online);
    expect(f.online['fs-1']).toEqual(online);
    f = toggleFav(f, online);
    expect(f.online).toEqual({});
  });

  it('merges remote favorites and reports which to upload', () => {
    const local = { ids: [UUID_A, 'local-1'], online: {} };
    const { store, toUpload } = mergeRemote(local, [UUID_B]);
    expect(store.ids).toEqual([UUID_A, 'local-1', UUID_B]);
    expect(toUpload).toEqual([UUID_A]);
  });

  it('returns the same store when nothing new comes from the account', () => {
    const local = { ids: [UUID_A], online: {} };
    expect(mergeRemote(local, [UUID_A]).store).toBe(local);
  });

  it('resolves favorites in order and skips missing songs', () => {
    const f = { ids: ['fs-1', 'gone', 'b', 'a'], online: { 'fs-1': s('fs-1', { online: true }) } };
    const list = resolveFavs(f, [[s('a')], [s('b'), s('a', { title: 'dupe' })]]);
    expect(list.map((x) => x.id)).toEqual(['fs-1', 'b', 'a']);
    expect(list[2].title).toBe('a'); // first list wins
  });

  it('parses stored data safely', () => {
    expect(parseFavs(null)).toEqual(emptyFavs);
    expect(parseFavs('nope')).toEqual(emptyFavs);
    expect(parseFavs(JSON.stringify({ ids: ['a', 'a', 3, 'b'] }))).toEqual({ ids: ['a', 'b'], online: {} });
  });
});
