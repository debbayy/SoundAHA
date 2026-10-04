import { append, insertNext, pickNext, upNext } from '../queue';
import { Sound } from '../../types';

const song = (id: string, audio_url = `https://x/${id}.mp3`): Sound => ({ id, title: id, category: 'music', audio_url, duration: 10 });
const q = [song('a'), song('b'), song('c')];
const ids = (s: Sound | null) => s?.id ?? null;

describe('pickNext', () => {
  it('returns null without a current song or with a single-song queue', () => {
    expect(pickNext(q, undefined, { shuffle: false, wrap: true })).toBeNull();
    expect(pickNext([song('a')], 'a', { shuffle: false, wrap: true })).toBeNull();
  });

  it('moves to the following song', () => {
    expect(ids(pickNext(q, 'a', { shuffle: false, wrap: false }))).toBe('b');
  });

  it('stops at the end unless wrapping', () => {
    expect(pickNext(q, 'c', { shuffle: false, wrap: false })).toBeNull();
    expect(ids(pickNext(q, 'c', { shuffle: false, wrap: true }))).toBe('a');
  });

  it('skips songs without audio', () => {
    const list = [song('a'), song('b', ''), song('c')];
    expect(ids(pickNext(list, 'a', { shuffle: false, wrap: false }))).toBe('c');
  });

  it('shuffles among the other playable songs', () => {
    const list = [song('a'), song('b', ''), song('c'), song('d')];
    expect(ids(pickNext(list, 'a', { shuffle: true, wrap: false }, () => 0))).toBe('c');
    expect(ids(pickNext(list, 'a', { shuffle: true, wrap: false }, () => 0.99))).toBe('d');
  });

  it('returns null when nothing else is playable', () => {
    expect(pickNext([song('a'), song('b', '')], 'a', { shuffle: true, wrap: true })).toBeNull();
    expect(pickNext([song('a'), song('b', '')], 'a', { shuffle: false, wrap: true })).toBeNull();
  });
});

describe('queue edits', () => {
  const list = () => [song('a'), song('b'), song('c')];
  const order = (q: Sound[]) => q.map((x) => x.id);

  it('play next puts the song right after the current one', () => {
    expect(order(insertNext(list(), 'a', song('x')))).toEqual(['a', 'x', 'b', 'c']);
    expect(order(insertNext(list(), 'a', song('c')))).toEqual(['a', 'c', 'b']); // moved, not duplicated
    expect(order(insertNext(list(), 'a', song('a')))).toEqual(['a', 'b', 'c']); // current song: unchanged
  });

  it('add to queue puts the song at the end', () => {
    expect(order(append(list(), 'a', song('x')))).toEqual(['a', 'b', 'c', 'x']);
    expect(order(append(list(), 'a', song('b')))).toEqual(['a', 'c', 'b']);
  });

  it('up next lists what follows the current song', () => {
    expect(order(upNext(list(), 'b'))).toEqual(['c']);
    expect(order(upNext(list(), 'zz'))).toEqual(['a', 'b', 'c']);
  });
});
