import { MAX_SAVED_QUEUE, parseSession, serializeSession } from '../playerSession';
import { Sound } from '../../types';

const remote = (id: string): Sound => ({ id, title: id, category: 'music', audio_url: `https://x/${id}.mp3`, duration: 30 });
const bundled = (id: string, asset: number): Sound => ({ id, title: id, category: 'meme', audio_url: '', audio_source: asset, duration: 2 });

describe('player session', () => {
  it('round-trips a session', () => {
    const q = [remote('a'), remote('b')];
    const ses = parseSession(serializeSession(q[1], q, 42.7), []);
    expect(ses).toEqual({ current: q[1], queue: q, position: 42 });
  });

  it('stores bundled sounds by id and re-attaches the current asset', () => {
    const raw = serializeSession(bundled('1', 11), [bundled('1', 11), remote('a')], 0);
    expect(raw).not.toContain('audio_source');
    const ses = parseSession(raw, [bundled('1', 99)]); // asset number changed in a new build
    expect(ses?.current.audio_source).toBe(99);
    expect(ses?.queue.map((s) => s.id)).toEqual(['1', 'a']);
  });

  it('drops bundled sounds that no longer exist', () => {
    const raw = serializeSession(remote('a'), [bundled('gone', 1), remote('a')], 5);
    expect(parseSession(raw, [])?.queue.map((s) => s.id)).toEqual(['a']);
    expect(parseSession(serializeSession(bundled('gone', 1), [], 0), [])).toBeNull();
  });

  it('keeps the current song in the queue', () => {
    const ses = parseSession(serializeSession(remote('a'), [remote('b')], 0), []);
    expect(ses?.queue.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('caps a huge queue around the current song', () => {
    const q = Array.from({ length: 2000 }, (_, i) => remote(String(i)));
    const ses = parseSession(serializeSession(q[1500], q, 0), [])!;
    expect(ses.queue).toHaveLength(MAX_SAVED_QUEUE);
    expect(ses.queue.some((s) => s.id === '1500')).toBe(true);
    expect(ses.queue[0].id).toBe(String(1500 - MAX_SAVED_QUEUE / 2));
  });

  it('ignores missing or corrupt data', () => {
    expect(parseSession(null, [])).toBeNull();
    expect(parseSession('not json', [])).toBeNull();
    expect(parseSession('{"v":2}', [])).toBeNull();
    expect(parseSession(JSON.stringify({ v: 1, current: remote('a'), queue: 'x', position: -3 }), [])).toEqual({
      current: remote('a'), queue: [remote('a')], position: 0,
    });
  });
});
