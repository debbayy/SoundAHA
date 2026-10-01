import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Sound } from '../types';

type Ctx = { current: Sound | null; playing: boolean; play: (s: Sound) => void; toggle: () => void };
const PlayerCtx = createContext<Ctx>({ current: null, playing: false, play: () => {}, toggle: () => {} });
export const usePlayer = () => useContext(PlayerCtx);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const ref = useRef<AudioPlayer | null>(null);
  const [current, setCurrent] = useState<Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => ref.current?.remove();
  }, []);

  const play = (s: Sound) => {
    setCurrent(s);
    try {
      ref.current?.remove();
      const source = s.audio_source ?? (s.audio_url ? { uri: s.audio_url } : null);
      if (!source) { setPlaying(false); return; }
      const p = createAudioPlayer(source);
      p.addListener('playbackStatusUpdate', (st) => { if (st.didJustFinish) setPlaying(false); });
      p.play();
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

  return <PlayerCtx.Provider value={{ current, playing, play, toggle }}>{children}</PlayerCtx.Provider>;
}
