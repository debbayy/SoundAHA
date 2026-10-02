import { createContext, ReactNode, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Sound } from '../types';

type Ctx = {
  current: Sound | null;
  playing: boolean;
  play: (s: Sound) => void;
  toggle: () => void;
  stopIf: (id: string) => void;
  seekTo: (seconds: number) => void; // jump to a position in the current song
};
const PlayerCtx = createContext<Ctx>({ current: null, playing: false, play: () => {}, toggle: () => {}, stopIf: () => {}, seekTo: () => {} });
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

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => {});
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
      p.setActiveForLockScreen(true, { title: s.title, artist: 'Soundly' });
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

  return <PlayerCtx.Provider value={{ current, playing, play, toggle, stopIf, seekTo }}>{children}</PlayerCtx.Provider>;
}
