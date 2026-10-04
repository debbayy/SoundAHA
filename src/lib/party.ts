import { Sound } from '../types';

// ---- Party: several phones playing the same song at the same moment ---------------------------
//
// Phones meet in a Supabase Realtime channel named after a short code. The host's clock is the
// "party clock": every member measures how far its own clock is from the host's, and every
// play / pause / seek / song change is sent as a PartyState stamped in party time, so each phone
// can work out where the song should be right now. Anyone in the party can control playback; the
// newest change wins.

// No 0/O, 1/I/L: easy to read out loud and to type.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function makeCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
  return out;
}

// What someone typed, as a code: upper case, spaces / dashes and characters codes never use dropped.
export function normalizeCode(input: string): string {
  return [...input.toUpperCase()].filter((c) => CODE_CHARS.includes(c)).join('').slice(0, CODE_LENGTH);
}

export const isValidCode = (code: string) => code.length === CODE_LENGTH && [...code].every((c) => CODE_CHARS.includes(c));

// Where the song plays from, on every phone.
//  seed: a sound bundled with the app (everyone has it)
//  url:  a file anyone can download (server sounds, Freesound previews, uploaded party files)
export type PartySource = { kind: 'seed'; id: string } | { kind: 'url'; url: string };

export type PartySound = {
  key: string; // the same song has the same key on every phone
  title: string;
  artist?: string;
  album?: string;
  emoji?: string;
  category: Sound['category'];
  duration: number;
  source: PartySource;
};

export type PartyState = {
  sound: PartySound | null;
  position: number; // seconds into the song at `at`
  at: number; // party time (ms)
  playing: boolean;
  rate: number;
  from: string; // member id that made the change
};

// Stable short hash for building keys out of URLs / ids.
export function hash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36);
}

// A song that only exists on this phone (an import) has to be uploaded before others can play it.
export const needsUpload = (s: Sound) =>
  s.audio_source === undefined && !/^https?:\/\//i.test(s.audio_url) && !s.party_key;

// The key a song is known by in the party.
export function partyKey(s: Sound): string {
  if (s.party_key) return s.party_key; // a song this phone received from the party
  if (s.audio_source !== undefined) return `seed:${s.id}`;
  if (/^https?:\/\//i.test(s.audio_url)) return `url:${hash(s.audio_url)}`;
  return `up:${hash(s.fingerprint ?? s.id)}`;
}

// Describe a song for the other phones. `urls` holds the download links already known for keys
// (uploaded files, songs received from the party). Null when the song still has to be uploaded.
export function toPartySound(s: Sound, urls: Record<string, string>): PartySound | null {
  const key = partyKey(s);
  let source: PartySource;
  if (s.audio_source !== undefined && !s.party_key) source = { kind: 'seed', id: s.id };
  else if (urls[key]) source = { kind: 'url', url: urls[key] };
  else if (/^https?:\/\//i.test(s.audio_url)) source = { kind: 'url', url: s.audio_url };
  else return null;
  return { key, title: s.title, artist: s.artist, album: s.album, emoji: s.emoji, category: s.category, duration: s.duration, source };
}

// Shared files live in a private bucket under the uploader's own folder (storage rules only let a
// user write there) and are handed out as signed links that stop working after a while.
export const SIGNED_URL_SECONDS = 6 * 60 * 60;

// Limits that keep a party (and the free server plan) in check.
export const MAX_MEMBERS = 8; // each shared song is downloaded by every other phone
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Who is over the member limit: the latest to join (ties: by id, the same on every phone).
export function overflowIds(members: { id: string; joinedAt: number }[], max = MAX_MEMBERS): string[] {
  return [...members].sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1)).slice(max).map((m) => m.id);
}
export const partyFilePath = (userId: string, code: string, key: string, ext: string) =>
  `${userId}/${code}/${key.replace(/[^a-z0-9]/gi, '_')}.${ext.replace(/[^a-z0-9]/gi, '') || 'mp3'}`;

// Where the song should be at party time `now`.
export function expectedPosition(st: PartyState, now: number): number {
  const elapsed = st.playing ? Math.max(0, now - st.at) / 1000 * st.rate : 0;
  const pos = st.position + elapsed;
  const dur = st.sound?.duration ?? 0;
  return dur > 0 ? Math.min(pos, dur) : pos;
}

// Newest change wins; on a tie (same millisecond) the member id decides, the same way everywhere.
export const isNewer = (a: PartyState, b: PartyState | null) => !b || a.at > b.at || (a.at === b.at && a.from > b.from);

// Clock offset to the host from ping round trips: host time = local time + offset. Uses the fastest
// round trips, whose midpoint guess is the most accurate.
export type ClockSample = { sent: number; hostTime: number; received: number };
export function clockOffset(samples: ClockSample[]): number | null {
  if (!samples.length) return null;
  const best = [...samples].sort((a, b) => (a.received - a.sent) - (b.received - b.sent)).slice(0, 3);
  const offsets = best.map((x) => x.hostTime - (x.sent + x.received) / 2).sort((a, b) => a - b);
  return offsets[Math.floor(offsets.length / 2)];
}

// How far off this phone may be before it jumps back in line (seconds). Below this a seek would
// itself cause a hiccup bigger than the drift.
export const DRIFT_LIMIT = 0.15;
export const isDrifting = (actual: number, expected: number) => Math.abs(actual - expected) > DRIFT_LIMIT;
