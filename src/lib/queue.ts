import { Sound } from '../types';

export const hasSource = (s: Sound) => !!(s.audio_source ?? s.audio_url);

// Next song to play after `currentId` in `queue`, or null if there is none. Without shuffle the
// queue ends at its last song unless `wrap` is set (manual "next" wraps, autoplay does not).
// Songs without audio are skipped.
export function pickNext(
  queue: Sound[],
  currentId: string | undefined,
  opts: { shuffle: boolean; wrap: boolean },
  random: () => number = Math.random,
): Sound | null {
  if (!currentId || queue.length < 2) return null;
  if (opts.shuffle) {
    const pool = queue.filter((x) => x.id !== currentId && hasSource(x));
    return pool.length ? pool[Math.floor(random() * pool.length)] : null;
  }
  const i = queue.findIndex((x) => x.id === currentId);
  for (let step = 1; step < queue.length; step++) {
    const idx = i + step;
    if (idx >= queue.length && !opts.wrap) return null;
    const cand = queue[idx % queue.length];
    if (hasSource(cand)) return cand;
  }
  return null;
}

// "Play next": the song goes right after the current one (moved there if it was already queued).
export function insertNext(queue: Sound[], currentId: string | undefined, s: Sound): Sound[] {
  if (s.id === currentId) return queue;
  const rest = queue.filter((x) => x.id !== s.id);
  const i = rest.findIndex((x) => x.id === currentId);
  return [...rest.slice(0, i + 1), s, ...rest.slice(i + 1)];
}

// "Add to queue": the song goes to the end (moved there if it was already queued).
export function append(queue: Sound[], currentId: string | undefined, s: Sound): Sound[] {
  if (s.id === currentId) return queue;
  return [...queue.filter((x) => x.id !== s.id), s];
}

// The songs that will play after the current one, in order (what the queue screen lists).
export function upNext(queue: Sound[], currentId: string | undefined): Sound[] {
  const i = queue.findIndex((x) => x.id === currentId);
  return i < 0 ? queue : queue.slice(i + 1);
}
