import {
  addToPlaylist, createPlaylist, deletePlaylist, emptyPlaylists, emptyStats, forgetSound, groupBy, MAX_RECENT,
  parsePlaylists, parseStats, recordPlay, removeFromPlaylist, renamePlaylist, resolveIds, topPlayed,
} from '../library';
import { Sound } from '../../types';

const s = (id: string, extra: Partial<Sound> = {}): Sound => ({ id, title: id, category: 'music', audio_url: 'u', duration: 1, ...extra });
const online = (id: string) => s(id, { online: true });

describe('resolveIds', () => {
  it('keeps order, prefers earlier lists, uses snapshots, skips missing', () => {
    const out = resolveIds(['c', 'x', 'a', 'fs'], [[s('a', { title: 'first' })], [s('a'), s('c')]], { fs: online('fs') });
    expect(out.map((x) => x.id)).toEqual(['c', 'a', 'fs']);
    expect(out[1].title).toBe('first');
  });
});

describe('playlists', () => {
  it('creates newest first with an optional first song and a clean name', () => {
    let st = createPlaylist(emptyPlaylists, '  Road   trip ', 'p1', s('a'));
    st = createPlaylist(st, '', 'p2');
    expect(st.lists).toEqual([{ id: 'p2', name: 'My playlist', ids: [] }, { id: 'p1', name: 'Road trip', ids: ['a'] }]);
  });

  it('adds songs once, keeps online copies and drops them when no playlist uses them', () => {
    let st = createPlaylist(emptyPlaylists, 'A', 'p1');
    st = createPlaylist(st, 'B', 'p2');
    st = addToPlaylist(st, 'p1', online('fs'));
    st = addToPlaylist(st, 'p1', online('fs'));
    st = addToPlaylist(st, 'p2', online('fs'));
    expect(st.lists.find((p) => p.id === 'p1')!.ids).toEqual(['fs']);
    st = removeFromPlaylist(st, 'p1', 'fs');
    expect(st.online.fs).toBeDefined(); // still in p2
    st = deletePlaylist(st, 'p2');
    expect(st.online).toEqual({});
  });

  it('ignores adding to a missing playlist and renames', () => {
    const st = createPlaylist(emptyPlaylists, 'A', 'p1');
    expect(addToPlaylist(st, 'nope', s('a'))).toBe(st);
    expect(renamePlaylist(st, 'p1', ' Chill ').lists[0].name).toBe('Chill');
  });

  it('parses stored data safely', () => {
    expect(parsePlaylists(null)).toEqual(emptyPlaylists);
    expect(parsePlaylists('{bad')).toEqual(emptyPlaylists);
    expect(parsePlaylists(JSON.stringify({ lists: [{ id: 'p', name: 'X', ids: ['a', 'a', 1] }, { name: 'no id' }] })))
      .toEqual({ lists: [{ id: 'p', name: 'X', ids: ['a'] }], online: {} });
  });
});

describe('play stats', () => {
  it('records recent (newest first, no duplicates) and counts', () => {
    let st = recordPlay(emptyStats, s('a'));
    st = recordPlay(st, s('b'));
    st = recordPlay(st, s('a'));
    expect(st.recent).toEqual(['a', 'b']);
    expect(st.counts).toEqual({ a: 2, b: 1 });
  });

  it('caps recent and only keeps online copies that are still recent', () => {
    let st = recordPlay(emptyStats, online('fs'));
    for (let i = 0; i < MAX_RECENT; i++) st = recordPlay(st, s(String(i)));
    expect(st.recent).toHaveLength(MAX_RECENT);
    expect(st.recent).not.toContain('fs');
    expect(st.online).toEqual({});
  });

  it('ranks most played, breaking ties by recency, with a minimum', () => {
    const st = { recent: ['c', 'b', 'a'], counts: { a: 3, b: 2, c: 2, d: 1 }, online: {} };
    expect(topPlayed(st, 10)).toEqual(['a', 'c', 'b']);
    expect(topPlayed(st, 1)).toEqual(['a']);
    expect(topPlayed(st, 10, 3)).toEqual(['a']);
  });

  it('forgets a sound', () => {
    const st = forgetSound(recordPlay(emptyStats, s('a')), 'a');
    expect(st).toEqual(emptyStats);
  });

  it('parses stored data safely', () => {
    expect(parseStats(null)).toEqual(emptyStats);
    expect(parseStats('x')).toEqual(emptyStats);
  });
});

describe('groupBy', () => {
  it('groups by tag ignoring case/spacing, sorts A-Z, skips untagged', () => {
    const gs = groupBy([
      s('1', { artist: 'Zed' }), s('2', { artist: 'adele' }), s('3', { artist: ' Adele ' }), s('4'), s('5', { artist: '  ' }),
    ], 'artist');
    expect(gs.map((g) => [g.name, g.sounds.map((x) => x.id)])).toEqual([['adele', ['2', '3']], ['Zed', ['1']]]);
  });
});
