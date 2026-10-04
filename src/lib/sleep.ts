// Sleep timer choices, in minutes. 'end' = stop when the current song finishes.
export type SleepChoice = number | 'end';
export const SLEEP_CHOICES: SleepChoice[] = [15, 30, 45, 60, 'end'];

// Time left as m:ss (or h:mm:ss), rounded up so it never shows 0:00 while still running.
export function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
