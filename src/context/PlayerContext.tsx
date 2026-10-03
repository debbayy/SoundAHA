import { createContext, ReactNode, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Sound } from '../types';

// Playback speed range (slow ... fast) and the slider's step.
export const MIN_RATE = 0.25;
export const MAX_RATE = 2;
export const RATE_STEP = 0.05;
const clampRate = (r: number) => Math.round(Math.min(MAX_RATE, Math.max(MIN_RATE, r)) * 100) / 100;
const RATE_KEY = 'soundly.playbackRate';
const MODE_KEY = 'soundly.playMode';

// autoplay: when a song ends, start the next one from the list it was played from.
// loop:     repeat the current song forever (wins over autoplay).
// shuffle:  "next" picks a random song instead of the following one.
export type PlayMode = { autoplay: boolean; loop: boolean; shuffle: boolean };
const DEFAULT_MODE: PlayMode = { autoplay: true, loop: false, shuffle: false };

type Ctx = {
  current: Sound | null;
  playing: boolean;
  rate: number; // playback speed, 1 = normal
  mode: PlayMode;
  canSkip: boolean; // there is more than one song in the queue
  setRate: (rate: number, save?: boolean) => void; // apply a speed; save=false while the slider is still being dragged
  setMode: (patch: Partial<PlayMode>) => void;
  play: (s: Sound, queue?: Sound[]) => void; // `queue` = the list the song was picked from
  toggle: () => void;
  next: () => void;
  prev: () => void;
  stopIf: (id: string) => void;
  seekTo: (seconds: number) => void; // jump to a position in the current song
};
const noop = () => {};
const PlayerCtx = createContext<Ctx>({
  current: null, playing: false, rate: 1, mode: DEFAULT_MODE, canSkip: false,
  setRate: noop, setMode: noop, play: noop, toggle: noop, next: noop, prev: noop, stopIf: noop, seekTo: noop,
});
export const usePlayer = () => useContext(PlayerCtx);

// Playback position changes several times a second. It lives in its own tiny store so only the
// seek bar re-renders for it, not every song row that reads usePlayer().
type Progress = { position: number; duration: number };
let progress: Progress = { position: 0, duration: 0 };
const listeners = new Set<() => void>();
const setProgress = (next: Progress) => {
  if (next.position === progress.position && next.duration === progress.duration) return;
  progress = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useProgress = () => useSyncExternalStore(subscribe, () => progress);

const hasSource = (s: Sound) => !!(s.audio_source ?? s.audio_url);

// Keep playing when the app goes to the background or the screen locks. Applied again before
// every song, not just once at start-up: if this call ever fails, iOS pauses the song as soon as
// the app leaves the screen.
const applyAudioMode = () =>
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' })
    .catch((e) => console.warn('[player] setAudioModeAsync failed', e));

export function PlayerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AudioPlayer | null>(null);
  const [current, setCurrent] = useState<Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const [mode, setModeState] = useState<PlayMode>(DEFAULT_MODE);
  const [queueLen, setQueueLen] = useState(0);

  // Refs mirror the state the audio callbacks need, so they never read a stale value.
  const rateRef = useRef(1);
  const modeRef = useRef<PlayMode>(DEFAULT_MODE);
  const currentRef = useRef<Sound | null>(null);
  const queueRef = useRef<Sound[]>([]);
  const historyRef = useRef<string[]>([]); // ids played before the current one, for "previous"

  useEffect(() => {
    applyAudioMode();
    AsyncStorage.getItem(RATE_KEY)
      .then((v) => {
        const r = Number(v);
        if (v && r >= MIN_RATE && r <= MAX_RATE) { rateRef.current = r; setRateState(r); }
      })
      .catch(() => {});
    AsyncStorage.getItem(MODE_KEY)
      .then((v) => {
        if (!v) return;
        const m = { ...DEFAULT_MODE, ...JSON.parse(v) } as PlayMode;
        modeRef.current = m;
        setModeState(m);
      })
      .catch(() => {});
    return () => stopCurrent();
  }, []);

  // Silence and free the loaded player. remove() alone doesn't always stop the sound (the lock
  // screen can still hold the player), so pause and release the lock screen first. Each step is
  // guarded on its own so one failing can't leave the old song playing.
  const stopCurrent = () => {
    const p = ref.current;
    ref.current = null;
    if (!p) return;
    try { p.pause(); } catch {}
    try { p.clearLockScreenControls(); } catch {}
    try { p.remove(); } catch {}
  };

  const setQueue = (list: Sound[]) => {
    queueRef.current = list;
    setQueueLen(list.length);
  };

  // Next song to play after the current one, or null if there is none. Without shuffle the queue
  // ends at its last song unless `wrap` is set (manual "next" wraps, autoplay does not).
  const pickNext = (wrap: boolean): Sound | null => {
    const q = queueRef.current;
    const cur = currentRef.current;
    if (!cur || q.length < 2) return null;
    if (modeRef.current.shuffle) {
      const pool = q.filter((x) => x.id !== cur.id && hasSource(x));
      return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    }
    const i = q.findIndex((x) => x.id === cur.id);
    for (let step = 1; step < q.length; step++) {
      const idx = i + step;
      if (idx >= q.length && !wrap) return null;
      const cand = q[idx % q.length];
      if (hasSource(cand)) return cand;
    }
    return null;
  };

  const startPlayback = (s: Sound) => {
    currentRef.current = s;
    setCurrent(s);
    setProgress({ position: 0, duration: s.duration || 0 });
    stopCurrent();
    const source = s.audio_source ?? (s.audio_url ? { uri: s.audio_url } : null);
    if (!source) { setPlaying(false); return; }
    let p: AudioPlayer;
    try {
      p = createAudioPlayer(source, { updateInterval: 250 });
    } catch {
      setPlaying(false);
      return;
    }
    // Track it before anything else can throw, so the next song always finds and stops it.
    ref.current = p;
    applyAudioMode();
    try {
      p.loop = modeRef.current.loop;
      p.addListener('playbackStatusUpdate', (st) => {
        if (ref.current !== p) return; // a replaced player must not move the bar or trigger autoplay
        setProgress({ position: st.currentTime, duration: st.duration || progress.duration });
        if (st.didJustFinish) onEnded.current();
      });
      p.play();
      setPlaying(true);
    } catch {
      stopCurrent();
      setPlaying(false);
      return;
    }
    // Extras: a failure here must not stop the song that's already playing.
    try {
      p.shouldCorrectPitch = true; // keep the voice natural when sped up or slowed down
      p.setPlaybackRate(rateRef.current, 'high'); // after play(): some platforms reset the rate on start
    } catch {}
    try {
      p.setActiveForLockScreen(true, {
        title: s.title,
        artist: s.artist || 'Soundly',
        albumTitle: s.album,
        artworkUrl: s.cover_url ?? s.thumbnail_url ?? undefined,
      });
    } catch {}
  };

  const play = (s: Sound, list?: Sound[]) => {
    if (list) setQueue(list);
    else if (!queueRef.current.some((x) => x.id === s.id)) setQueue([s]);
    const prevSong = currentRef.current;
    if (prevSong && prevSong.id !== s.id) historyRef.current = [...historyRef.current.slice(-49), prevSong.id];
    startPlayback(s);
  };

  // A song finished on its own.
  const onEnded = useRef(() => {});
  onEnded.current = () => {
    if (modeRef.current.loop) {
      // The player loops by itself; if a platform still reports the end, just keep going.
      try { ref.current?.seekTo(0); ref.current?.play(); } catch {}
      setPlaying(true);
      return;
    }
    if (modeRef.current.autoplay) {
      const n = pickNext(false);
      if (n) { play(n); return; }
    }
    setPlaying(false);
  };

  const next = () => {
    const n = pickNext(true);
    if (n) play(n);
  };

  const prev = () => {
    const cur = currentRef.current;
    if (!cur) return;
    if (progress.position > 3) { seekTo(0); return; } // like most players: first tap restarts the song
    const id = historyRef.current[historyRef.current.length - 1];
    const back = id ? queueRef.current.find((x) => x.id === id) : undefined;
    if (back) {
      historyRef.current = historyRef.current.slice(0, -1);
      startPlayback(back);
      return;
    }
    const q = queueRef.current;
    const i = q.findIndex((x) => x.id === cur.id);
    if (i > 0) startPlayback(q[i - 1]);
    else seekTo(0);
  };

  const toggle = () => {
    const p = ref.current;
    if (!p) return;
    if (p.playing) { p.pause(); setPlaying(false); }
    else { if (p.duration > 0 && p.currentTime >= p.duration) p.seekTo(0); p.play(); setPlaying(true); }
  };

  const setMode = (patch: Partial<PlayMode>) => {
    const m = { ...modeRef.current, ...patch };
    modeRef.current = m;
    setModeState(m);
    if (ref.current) ref.current.loop = m.loop;
    AsyncStorage.setItem(MODE_KEY, JSON.stringify(m)).catch(() => {});
  };

  const setRate = (value: number, save = true) => {
    const nextRate = clampRate(value);
    rateRef.current = nextRate;
    setRateState(nextRate);
    try { ref.current?.setPlaybackRate(nextRate, 'high'); } catch {}
    if (save) AsyncStorage.setItem(RATE_KEY, String(nextRate)).catch(() => {});
  };

  const seekTo = (seconds: number) => {
    const p = ref.current;
    if (!p) return;
    const max = p.duration || progress.duration;
    const to = Math.max(0, max > 0 ? Math.min(seconds, max) : seconds);
    setProgress({ position: to, duration: progress.duration }); // move the bar right away
    p.seekTo(to).catch(() => {});
  };

  // A song was deleted: drop it from the queue, and stop the player if it is the one loaded.
  const stopIf = (id: string) => {
    setQueue(queueRef.current.filter((x) => x.id !== id));
    historyRef.current = historyRef.current.filter((x) => x !== id);
    if (currentRef.current?.id !== id) return;
    stopCurrent();
    currentRef.current = null;
    setCurrent(null);
    setPlaying(false);
    setProgress({ position: 0, duration: 0 });
  };

  return (
    <PlayerCtx.Provider value={{ current, playing, rate, mode, canSkip: queueLen > 1, setRate, setMode, play, toggle, next, prev, stopIf, seekTo }}>
      {children}
    </PlayerCtx.Provider>
  );
}
