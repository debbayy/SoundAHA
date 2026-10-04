import {
  clockOffset, CODE_LENGTH, expectedPosition, isDrifting, isNewer, isValidCode, makeCode, needsUpload, normalizeCode,
  overflowIds, partyFilePath, partyKey, PartyState, toPartySound,
} from '../party';
import { Sound } from '../../types';

const seed: Sound = { id: '1', title: 'Bruh', category: 'meme', audio_url: '', audio_source: 7, duration: 1 };
const remote: Sound = { id: 'uuid-1', title: 'Song', category: 'music', audio_url: 'https://x/song.mp3', duration: 200 };
const local: Sound = { id: 'local-1', title: 'Yolanda', artist: 'Kangen Band', category: 'local', local: true, audio_url: 'file:///doc/sounds/local-1.mp3', fingerprint: 'abc', duration: 240 };

const state = (over: Partial<PartyState> = {}): PartyState => ({
  sound: toPartySound(remote, {}), position: 10, at: 1_000, playing: true, rate: 1, from: 'a', ...over,
});

describe('codes', () => {
  it('makes readable codes of the right length', () => {
    const code = makeCode();
    expect(code).toHaveLength(CODE_LENGTH);
    expect(isValidCode(code)).toBe(true);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it('cleans what people type', () => {
    expect(normalizeCode(' ab-cd ef ')).toBe('ABCDEF');
    expect(normalizeCode('abcdefgh')).toBe('ABCDEF');
    expect(isValidCode(normalizeCode('ab0'))).toBe(false);
  });
});

describe('songs', () => {
  it('only imports need uploading', () => {
    expect(needsUpload(seed)).toBe(false);
    expect(needsUpload(remote)).toBe(false);
    expect(needsUpload(local)).toBe(true);
    expect(needsUpload({ ...local, party_key: 'up:x' })).toBe(false); // received from the party
  });

  it('gives each song one key on every phone', () => {
    expect(partyKey(seed)).toBe('seed:1');
    expect(partyKey(remote)).toMatch(/^url:/);
    expect(partyKey(local)).toMatch(/^up:/);
    expect(partyKey({ ...local, party_key: 'up:zz' })).toBe('up:zz');
  });

  it('describes songs for the others', () => {
    expect(toPartySound(seed, {})?.source).toEqual({ kind: 'seed', id: '1' });
    expect(toPartySound(remote, {})?.source).toEqual({ kind: 'url', url: 'https://x/song.mp3' });
    expect(toPartySound(local, {})).toBeNull(); // not uploaded yet
    const key = partyKey(local);
    expect(toPartySound(local, { [key]: 'https://s/party/up.mp3' })).toMatchObject({
      key, title: 'Yolanda', artist: 'Kangen Band', source: { kind: 'url', url: 'https://s/party/up.mp3' },
    });
  });
});

describe('shared files', () => {
  it('go under the uploader folder, then the party, with a safe name', () => {
    expect(partyFilePath('user-1', 'ABC234', 'up:x/y', 'mp3')).toBe('user-1/ABC234/up_x_y.mp3');
    expect(partyFilePath('u', 'C', 'k', '../')).toBe('u/C/k.mp3');
  });
});

describe('timing', () => {
  it('works out where the song should be', () => {
    expect(expectedPosition(state(), 3_000)).toBe(12);
    expect(expectedPosition(state({ rate: 1.5 }), 3_000)).toBe(13);
    expect(expectedPosition(state({ playing: false }), 9_000)).toBe(10);
    expect(expectedPosition(state({ position: 199 }), 10_000)).toBe(200); // not past the end
  });

  it('keeps the newest change, with a stable tie-break', () => {
    expect(isNewer(state({ at: 2 }), state({ at: 1 }))).toBe(true);
    expect(isNewer(state({ at: 1 }), state({ at: 2 }))).toBe(false);
    expect(isNewer(state({ at: 1, from: 'b' }), state({ at: 1, from: 'a' }))).toBe(true);
    expect(isNewer(state(), null)).toBe(true);
  });

  it('estimates the clock offset from the fastest round trips', () => {
    // host is 500 ms ahead; one slow round trip is ignored
    const samples = [
      { sent: 0, hostTime: 520, received: 40 },
      { sent: 100, hostTime: 615, received: 130 },
      { sent: 200, hostTime: 1200, received: 900 },
      { sent: 300, hostTime: 812, received: 324 },
    ];
    expect(clockOffset(samples)).toBe(500);
    expect(clockOffset([])).toBeNull();
  });

  it('only corrects noticeable drift', () => {
    expect(isDrifting(10.1, 10)).toBe(false);
    expect(isDrifting(10.3, 10)).toBe(true);
  });
});

describe('member limit', () => {
  it('turns away the latest to join, the same way on every phone', () => {
    const ms = [
      { id: 'host', joinedAt: 1 }, { id: 'b', joinedAt: 5 }, { id: 'a', joinedAt: 5 }, { id: 'late', joinedAt: 9 },
    ];
    expect(overflowIds(ms, 3)).toEqual(['late']);
    expect(overflowIds(ms, 2)).toEqual(['b', 'late']);
    expect(overflowIds(ms, 8)).toEqual([]);
  });
});
