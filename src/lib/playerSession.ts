import { Sound } from '../types';

// What the player remembers between launches: the song, the list it was played from and where it
// was. Bundled sounds are stored by id only, because their require() asset number can change from
// one build to the next; they are looked up again in `bundled` when restoring.
export type PlayerSession = { current: Sound; queue: Sound[]; position: number };
type Saved = { v: 1; current: Sound; queue: Sound[]; position: number };

// A folder can hold thousands of songs; keep the save small for slow phones.
export const MAX_SAVED_QUEUE = 500;

const strip = (s: Sound): Sound => {
  if (s.audio_source === undefined) return s;
  const { audio_source, ...rest } = s;
  return rest;
};

export function serializeSession(current: Sound, queue: Sound[], position: number): string {
  let q = queue;
  if (q.length > MAX_SAVED_QUEUE) {
    // keep a window around the current song so next / previous still work after restoring
    const i = Math.max(0, q.findIndex((x) => x.id === current.id));
    const start = Math.min(Math.max(0, i - Math.floor(MAX_SAVED_QUEUE / 2)), q.length - MAX_SAVED_QUEUE);
    q = q.slice(start, start + MAX_SAVED_QUEUE);
  }
  const saved: Saved = { v: 1, current: strip(current), queue: q.map(strip), position: Math.max(0, Math.floor(position)) };
  return JSON.stringify(saved);
}

export function parseSession(raw: string | null, bundled: Sound[]): PlayerSession | null {
  if (!raw) return null;
  let saved: Saved;
  try { saved = JSON.parse(raw); } catch { return null; }
  if (!saved || saved.v !== 1 || !saved.current?.id) return null;

  const byId = new Map(bundled.map((s) => [s.id, s]));
  // A sound without its own URL is a bundled one: it must still exist in this build.
  const revive = (s: Sound): Sound | null => (s.audio_url ? s : byId.get(s.id) ?? null);

  const current = revive(saved.current);
  if (!current) return null;
  const queue = (Array.isArray(saved.queue) ? saved.queue : []).map(revive).filter((x): x is Sound => !!x);
  if (!queue.some((x) => x.id === current.id)) queue.unshift(current);
  const position = Number.isFinite(saved.position) && saved.position > 0 ? saved.position : 0;
  return { current, queue, position };
}
