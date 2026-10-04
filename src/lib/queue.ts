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
