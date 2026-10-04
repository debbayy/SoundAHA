import { createContext, ReactNode, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Sound } from '../types';
import { SEED } from '../data/seed';
import { append, insertNext, pickNext as pickFrom } from '../lib/queue';
import { useLibrary } from './LibraryContext';
import { parseSession, serializeSession } from '../lib/playerSession';
import { SleepChoice } from '../lib/sleep';
import { isDrifting } from '../lib/party';
import { cachedUri, cacheInBackground, isRemote } from '../lib/audioCache';

// Playback speed range (slow ... fast) and the slider's step.
export const MIN_RATE = 0.25;
export const MAX_RATE = 2;
export const RATE_STEP = 0.05;
const clampRate = (r: number) => Math.round(Math.min(MAX_RATE, Math.max(MIN_RATE, r)) * 100) / 100;
const RATE_KEY = 'soundly.playbackRate';
const MODE_KEY = 'soundly.playMode';
const SESSION_KEY = 'soundly.session'; // last song + its queue, written when the song changes
const POS_KEY = 'soundly.sessionPos'; // { id, position } of the last song, written every few seconds
const POS_SAVE_MS = 5000;

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
  queue: Sound[]; // the list being played through (includes the current song)
  canSkip: boolean; // there is more than one song in the queue
  playNext: (s: Sound) => void; // put a song right after the current one
  addToQueue: (s: Sound) => void; // put a song at the end of the queue
  removeFromQueue: (id: string) => void;
  sleepEndsAt: number | null; // sleep timer: when playback pauses (ms timestamp)
  sleepEndOfSong: boolean; // sleep timer: pause when the current song ends
  setSleep: (choice: SleepChoice | null) => void; // null = turn the timer off
  setRate: (rate: number, save?: boolean) => void; // apply a speed; save=false while the slider is still being dragged
  setMode: (patch: Partial<PlayMode>) => void;
  play: (s: Sound, queue?: Sound[]) => void; // `queue` = the list the song was picked from
  cue: (s: Sound, queue?: Sound[]) => void; // load a song without playing it (play / toggle starts it)
  toggle: () => void;
  next: () => void;
  prev: () => void;
  stopIf: (id: string) => void;
  seekTo: (seconds: number) => void; // jump to a position in the current song
  // Party sync (see PartyContext): what this phone plays right now, a way to hear about every change
  // the user makes, and a way to apply a change that came from another phone without echoing it back.
  snapshot: () => PlayerSnapshot;
  actualPosition: () => number | null; // where the loaded song really is (null when not playing)
  subscribeControl: (fn: () => void) => () => void;
  applyRemote: (st: PlayerSnapshot) => void;
};
export type PlayerSnapshot = { sound: Sound | null; position: number; playing: boolean; rate: number };
const noop = () => {};
const PlayerCtx = createContext<Ctx>({
  current: null, playing: false, rate: 1, mode: DEFAULT_MODE, queue: [], canSkip: false, playNext: noop, addToQueue: noop, removeFromQueue: noop,
  sleepEndsAt: null, sleepEndOfSong: false, setSleep: noop, setRate: noop, setMode: noop, play: noop, cue: noop, toggle: noop, next: noop, prev: noop, stopIf: noop, seekTo: noop,
  snapshot: () => ({ sound: null, position: 0, playing: false, rate: 1 }), actualPosition: () => null,
  subscribeControl: () => noop, applyRemote: noop,
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

// Keep playing when the app goes to the background or the screen locks. Applied again before
// every song, not just once at start-up: if this call ever fails, iOS pauses the song as soon as
// the app leaves the screen.
const applyAudioMode = () =>
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' })
    .catch((e) => console.warn('[player] setAudioModeAsync failed', e));

export function PlayerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AudioPlayer | null>(null);
  const [current, setCurrent] = useState<Sound | null>(null);
  const [playing, setPlayingState] = useState(false);
  const playingRef = useRef(false);
  const setPlaying = (v: boolean) => { playingRef.current = v; setPlayingState(v); };

  // Changes made on this phone are announced to subscribers (the party). Changes applied from
  // another phone set `applying` so they are not announced back.
  const controlSubs = useRef(new Set<() => void>());
  const applying = useRef(false);
  const emit = () => { if (!applying.current) controlSubs.current.forEach((fn) => fn()); };
  const [rate, setRateState] = useState(1);
  const [mode, setModeState] = useState<PlayMode>(DEFAULT_MODE);
  const [queue, setQueueState] = useState<Sound[]>([]);
  const { recordPlay } = useLibrary();
  const recordRef = useRef(recordPlay);
  recordRef.current = recordPlay;

  // Refs mirror the state the audio callbacks need, so they never read a stale value.
  const rateRef = useRef(1);
  const modeRef = useRef<PlayMode>(DEFAULT_MODE);
  const currentRef = useRef<Sound | null>(null);
  const queueRef = useRef<Sound[]>([]);
  const historyRef = useRef<string[]>([]); // ids played before the current one, for "previous"
  const resumeAtRef = useRef(0); // restored song: where to start once the user presses play
  const lastPosSave = useRef(0);

  // Sleep timer. The timeout covers the app on screen; Android can hold JS timers while the app is
  // in the background, so the playback updates (which keep coming while a song plays) check too.
  const [sleepEndsAt, setSleepEndsAt] = useState<number | null>(null);
  const [sleepEndOfSong, setSleepEndOfSong] = useState(false);
  const sleepAtRef = useRef<number | null>(null);
  const sleepEndRef = useRef(false);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    applyAudioMode();
    Promise.all([AsyncStorage.getItem(SESSION_KEY), AsyncStorage.getItem(POS_KEY)])
      .then(([raw, posRaw]) => {
        if (currentRef.current) return; // the user already started a song
        const ses = parseSession(raw, SEED);
        if (!ses) return;
        let position = 0;
        try {
          const p = JSON.parse(posRaw ?? 'null');
          if (p?.id === ses.current.id && p.position > 0) position = p.position;
        } catch {}
        setQueue(ses.queue);
        currentRef.current = ses.current;
        setCurrent(ses.current);
        resumeAtRef.current = position;
        setProgress({ position, duration: ses.current.duration || 0 });
      })
      .catch(() => {});
    const appState = AppState.addEventListener('change', (st) => { if (st !== 'active') savePosition(); });
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
    return () => {
      appState.remove();
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
      stopCurrent();
    };
  }, []);

  const saveSession = () => {
    const cur = currentRef.current;
    if (cur) AsyncStorage.setItem(SESSION_KEY, serializeSession(cur, queueRef.current, 0)).catch(() => {});
    else AsyncStorage.multiRemove([SESSION_KEY, POS_KEY]).catch(() => {});
  };

  const savePosition = () => {
    const cur = currentRef.current;
    if (!cur) return;
    lastPosSave.current = Date.now();
    AsyncStorage.setItem(POS_KEY, JSON.stringify({ id: cur.id, position: Math.floor(progress.position) })).catch(() => {});
  };

  const pause = () => {
    try { ref.current?.pause(); } catch {}
    setPlaying(false);
    savePosition();
    emit();
  };

  const clearSleep = () => {
    if (sleepTimer.current) clearTimeout(sleepTimer.current);
    sleepTimer.current = null;
    sleepAtRef.current = null;
    sleepEndRef.current = false;
    setSleepEndsAt(null);
    setSleepEndOfSong(false);
    if (ref.current) ref.current.loop = modeRef.current.loop;
  };

  const sleepNow = () => {
    clearSleep();
    pause();
  };

  const setSleep = (choice: SleepChoice | null) => {
    clearSleep();
    if (choice === null) return;
    if (choice === 'end') {
      sleepEndRef.current = true;
      setSleepEndOfSong(true);
      if (ref.current) ref.current.loop = false; // a looping song never "ends"
      return;
    }
    const ms = choice * 60_000;
    sleepAtRef.current = Date.now() + ms;
    setSleepEndsAt(sleepAtRef.current);
    sleepTimer.current = setTimeout(sleepNow, ms);
  };

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
    setQueueState(list);
  };

  const pickNext = (wrap: boolean) =>
    pickFrom(queueRef.current, currentRef.current?.id, { shuffle: modeRef.current.shuffle, wrap });

  // `startAt`: seconds to begin from (a restored song, a party joining mid-song).
  // `autoplay` false: load it paused there (a party that is paused).
  const startPlayback = (s: Sound, startAt = 0, autoplay = true) => {
    currentRef.current = s;
    resumeAtRef.current = 0;
    setCurrent(s);
    setProgress({ position: startAt, duration: s.duration || 0 });
    saveSession();
    stopCurrent();
    // a song from the internet plays from its saved copy when there is one, and is saved for next time
    const source = s.audio_source ?? (s.audio_url ? { uri: cachedUri(s.audio_url) ?? s.audio_url } : null);
    if (!source) { setPlaying(false); return; }
    if (s.audio_source === undefined && isRemote(s.audio_url)) cacheInBackground(s.audio_url);
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
      p.loop = modeRef.current.loop && !sleepEndRef.current;
      p.addListener('playbackStatusUpdate', (st) => {
        if (ref.current !== p) return; // a replaced player must not move the bar or trigger autoplay
        setProgress({ position: st.currentTime, duration: st.duration || progress.duration });
        if (st.didJustFinish) { onEnded.current(); return; }
        if (!st.playing) return;
        if (sleepAtRef.current !== null && Date.now() >= sleepAtRef.current) { sleepNow(); return; }
        if (Date.now() - lastPosSave.current >= POS_SAVE_MS) savePosition();
      });
      if (startAt > 0) p.seekTo(startAt).catch(() => {});
      if (autoplay) {
        p.play();
        recordRef.current(s);
      }
      setPlaying(autoplay);
    } catch {
      stopCurrent();
      setPlaying(false);
      emit();
      return;
    }
    emit();
    // Extras: a failure here must not stop the song that's already playing.
    try {
      p.shouldCorrectPitch = true; // keep the voice natural when sped up or slowed down
      p.setPlaybackRate(rateRef.current, 'high'); // after play(): some platforms reset the rate on start
    } catch {}
    try {
      p.setActiveForLockScreen(true, {
        title: s.title,
        artist: s.artist || 'SoundAHA',
        albumTitle: s.album,
        artworkUrl: s.cover_url ?? s.thumbnail_url ?? undefined,
      });
    } catch {}
  };

  const enqueue = (s: Sound, list?: Sound[]) => {
    if (list) setQueue(list);
    else if (!queueRef.current.some((x) => x.id === s.id)) setQueue([s]);
    const prevSong = currentRef.current;
    if (prevSong && prevSong.id !== s.id) historyRef.current = [...historyRef.current.slice(-49), prevSong.id];
  };

  const play = (s: Sound, list?: Sound[]) => {
    enqueue(s, list);
    startPlayback(s);
  };

  // Show a song in the player, paused at the start. Nothing changes if it is already loaded.
  const cue = (s: Sound, list?: Sound[]) => {
    if (currentRef.current?.id === s.id) return;
    enqueue(s, list);
    stopCurrent();
    currentRef.current = s;
    resumeAtRef.current = 0;
    setCurrent(s);
    setPlaying(false);
    setProgress({ position: 0, duration: s.duration || 0 });
    saveSession();
    emit();
  };

  // A song finished on its own.
  const onEnded = useRef(() => {});
  onEnded.current = () => {
    if (sleepEndRef.current) {
      clearSleep();
      setPlaying(false);
      setProgress({ position: 0, duration: progress.duration }); // reopen at the start, not at the end
      savePosition();
      emit();
      return;
    }
    if (modeRef.current.loop) {
      // The player loops by itself; if a platform still reports the end, just keep going.
      try { ref.current?.seekTo(0); ref.current?.play(); } catch {}
      setPlaying(true);
      setProgress({ position: 0, duration: progress.duration });
      emit(); // a party starts the song over together
      return;
    }
    if (modeRef.current.autoplay) {
      const n = pickNext(false);
      if (n) { play(n); return; }
    }
    // Not announced: every phone in a party reaches the end by itself, and a phone with nothing
    // queued saying "stopped" must not cut off the next song another phone just started.
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
    if (!p) {
      // a song restored from the last session is only loaded when the user presses play
      const cur = currentRef.current;
      if (cur) startPlayback(cur, resumeAtRef.current);
      return;
    }
    if (p.playing) pause();
    else {
      if (p.duration > 0 && p.currentTime >= p.duration) { p.seekTo(0); setProgress({ position: 0, duration: progress.duration }); }
      p.play();
      setPlaying(true);
      emit();
    }
  };

  const setMode = (patch: Partial<PlayMode>) => {
    const m = { ...modeRef.current, ...patch };
    modeRef.current = m;
    setModeState(m);
    if (ref.current) ref.current.loop = m.loop && !sleepEndRef.current;
    AsyncStorage.setItem(MODE_KEY, JSON.stringify(m)).catch(() => {});
  };

  const setRate = (value: number, save = true) => {
    const nextRate = clampRate(value);
    rateRef.current = nextRate;
    setRateState(nextRate);
    try { ref.current?.setPlaybackRate(nextRate, 'high'); } catch {}
    if (save) {
      AsyncStorage.setItem(RATE_KEY, String(nextRate)).catch(() => {});
      emit(); // once the slider is let go, not on every step of the drag
    }
  };

  const seekTo = (seconds: number) => {
    const p = ref.current;
    if (!p) {
      // restored song not loaded yet: remember the spot for when play is pressed
      if (!currentRef.current) return;
      const max = progress.duration;
      const to = Math.max(0, max > 0 ? Math.min(seconds, max) : seconds);
      resumeAtRef.current = to;
      setProgress({ position: to, duration: progress.duration });
      emit();
      return;
    }
    const max = p.duration || progress.duration;
    const to = Math.max(0, max > 0 ? Math.min(seconds, max) : seconds);
    setProgress({ position: to, duration: progress.duration }); // move the bar right away
    p.seekTo(to).catch(() => {});
    emit();
  };

  // Queue edits. With nothing loaded yet, the song simply starts playing.
  const playNext = (s: Sound) => {
    if (!currentRef.current) { play(s); return; }
    setQueue(insertNext(queueRef.current, currentRef.current.id, s));
    saveSession();
  };

  const addToQueue = (s: Sound) => {
    if (!currentRef.current) { play(s); return; }
    setQueue(append(queueRef.current, currentRef.current.id, s));
    saveSession();
  };

  const removeFromQueue = (id: string) => {
    if (id === currentRef.current?.id) return; // the playing song stays; skip it with next instead
    setQueue(queueRef.current.filter((x) => x.id !== id));
    saveSession();
  };

  // A song was deleted: drop it from the queue, and stop the player if it is the one loaded.
  const stopIf = (id: string) => {
    setQueue(queueRef.current.filter((x) => x.id !== id));
    historyRef.current = historyRef.current.filter((x) => x !== id);
    if (currentRef.current?.id !== id) { saveSession(); return; }
    stopCurrent();
    currentRef.current = null;
    resumeAtRef.current = 0;
    setCurrent(null);
    setPlaying(false);
    setProgress({ position: 0, duration: 0 });
    saveSession();
    emit();
  };

  // ---- party sync ----
  const snapshot = (): PlayerSnapshot => {
    const p = ref.current;
    let position = progress.position;
    try { if (p?.isLoaded && p.currentTime > 0) position = p.currentTime; } catch {}
    return { sound: currentRef.current, position, playing: playingRef.current, rate: rateRef.current };
  };

  const actualPosition = () => {
    const p = ref.current;
    try { return p && p.isLoaded && p.playing ? p.currentTime : null; } catch { return null; }
  };

  const subscribeControl = (fn: () => void) => {
    controlSubs.current.add(fn);
    return () => { controlSubs.current.delete(fn); };
  };

  // Make this phone match a change from another phone (the song, where it is, playing, speed).
  const applyRemote = (st: PlayerSnapshot) => {
    applying.current = true;
    try {
      if (st.rate !== rateRef.current) setRate(st.rate, false);
      const cur = currentRef.current;
      if (!st.sound) {
        if (cur) stopIf(cur.id);
        return;
      }
      if (cur?.id !== st.sound.id) {
        enqueue(st.sound, [st.sound]);
        startPlayback(st.sound, st.position, st.playing);
        return;
      }
      const p = ref.current;
      if (!p) {
        if (st.playing) startPlayback(st.sound, st.position, true);
        else { resumeAtRef.current = st.position; setProgress({ position: st.position, duration: progress.duration }); }
        return;
      }
      if (isDrifting(p.isLoaded ? p.currentTime : progress.position, st.position)) {
        p.seekTo(st.position).catch(() => {});
        setProgress({ position: st.position, duration: progress.duration });
      }
      if (st.playing && !p.playing) { p.play(); setPlaying(true); }
      if (!st.playing && p.playing) { p.pause(); setPlaying(false); }
    } catch (e) {
      console.warn('[party] apply failed', e);
    } finally {
      applying.current = false;
    }
  };

  return (
    <PlayerCtx.Provider
      value={{ current, playing, rate, mode, queue, canSkip: queue.length > 1, playNext, addToQueue, removeFromQueue, sleepEndsAt, sleepEndOfSong, setSleep, setRate, setMode, play, cue, toggle, next, prev, stopIf, seekTo, snapshot, actualPosition, subscribeControl, applyRemote }}
    >
      {children}
    </PlayerCtx.Provider>
  );
}
