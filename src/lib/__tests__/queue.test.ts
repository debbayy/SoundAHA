import { pickNext } from '../queue';
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
