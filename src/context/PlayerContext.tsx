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

type Ctx = {
  current: Sound | null;
  playing: boolean;
  rate: number; // playback speed, 1 = normal
  setRate: (rate: number, save?: boolean) => void; // apply a speed; save=false while the slider is still being dragged
  play: (s: Sound) => void;
  toggle: () => void;
  stopIf: (id: string) => void;
  seekTo: (seconds: number) => void; // jump to a position in the current song
};
const PlayerCtx = createContext<Ctx>({ current: null, playing: false, rate: 1, setRate: () => {}, play: () => {}, toggle: () => {}, stopIf: () => {}, seekTo: () => {} });
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

export function PlayerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AudioPlayer | null>(null);
  const [current, setCurrent] = useState<Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);
  const rateRef = useRef(1); // read inside play(), so the next song keeps the chosen speed

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
    AsyncStorage.getItem(RATE_KEY)
      .then((v) => {
        const r = Number(v);
        if (v && r >= MIN_RATE && r <= MAX_RATE) { rateRef.current = r; setRateState(r); }
      })
      .catch(() => {});
    return () => ref.current?.remove();
  }, []);

  const play = (s: Sound) => {
    setCurrent(s);
    setProgress({ position: 0, duration: s.duration || 0 });
    try {
      ref.current?.remove();
      const source = s.audio_source ?? (s.audio_url ? { uri: s.audio_url } : null);
      if (!source) { setPlaying(false); return; }
      const p = createAudioPlayer(source, { updateInterval: 250 });
      p.addListener('playbackStatusUpdate', (st) => {
        setProgress({ position: st.currentTime, duration: st.duration || progress.duration });
        if (st.didJustFinish) setPlaying(false);
      });
      p.play();
      p.shouldCorrectPitch = true; // keep the voice natural when sped up or slowed down
      p.setPlaybackRate(rateRef.current, 'high'); // after play(): some platforms reset the rate on start
      p.setActiveForLockScreen(true, {
        title: s.title,
        artist: s.artist || 'Soundly',
        albumTitle: s.album,
        artworkUrl: s.cover_url ?? s.thumbnail_url ?? undefined,
      });
      ref.current = p;
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const toggle = () => {
    const p = ref.current;
    if (!p) return;
    if (p.playing) { p.pause(); setPlaying(false); }
    else { if (p.duration > 0 && p.currentTime >= p.duration) p.seekTo(0); p.play(); setPlaying(true); }
  };

  const setRate = (value: number, save = true) => {
    const next = clampRate(value);
    rateRef.current = next;
    setRateState(next);
    try { ref.current?.setPlaybackRate(next, 'high'); } catch {}
    if (save) AsyncStorage.setItem(RATE_KEY, String(next)).catch(() => {});
  };

  const seekTo = (seconds: number) => {
    const p = ref.current;
    if (!p) return;
    const max = p.duration || progress.duration;
    const to = Math.max(0, max > 0 ? Math.min(seconds, max) : seconds);
    setProgress({ position: to, duration: progress.duration }); // move the bar right away
    p.seekTo(to).catch(() => {});
  };

  // Stop and clear the player if the given sound is the one loaded (e.g. it was just deleted).
  const stopIf = (id: string) => {
    if (current?.id !== id) return;
    try { ref.current?.remove(); } catch {}
    ref.current = null;
    setCurrent(null);
    setPlaying(false);
    setProgress({ position: 0, duration: 0 });
  };

  return <PlayerCtx.Provider value={{ current, playing, rate, setRate, play, toggle, stopIf, seekTo }}>{children}</PlayerCtx.Provider>;
}
