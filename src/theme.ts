import { useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const dark = {
  isDark: true,
  bg: '#05050C',
  text: '#F5F6FF',
  muted: 'rgba(235,235,255,0.55)',
  accent: '#7C5CFF',
  accent2: '#00E5FF',
  danger: '#FF4D8D',
  border: 'rgba(255,255,255,0.10)',
  radius: 22,
  blurTint: 'dark' as 'dark' | 'light',
  // glass surfaces
  glassBlur: 'rgba(28,28,48,0.42)', // over a real blur (iOS)
  glassSolid: 'rgba(20,20,38,0.82)', // blur-less stand-in (Android, floating bars)
  glassRow: 'rgba(34,34,60,0.55)', // list rows / chips
  glassStroke: 'rgba(255,255,255,0.12)',
  sheen: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)'] as const,
  fill: 'rgba(255,255,255,0.10)', // thumbs, small icon buttons
  fillStrong: 'rgba(255,255,255,0.16)', // selected tab pill
  pillStroke: 'rgba(255,255,255,0.28)',
  input: 'rgba(0,0,0,0.28)',
  activeRing: 'rgba(0,229,255,0.55)',
  // water-droplet depth: outer drop shadow, inset rim light/dark, specular highlight
  dropShadow: '0 10 24 rgba(0,0,0,0.45)',
  dropRim: 'inset 0 1 1 rgba(255,255,255,0.20), inset 0 -1 1 rgba(255,255,255,0.10), inset 0 -10 16 -10 rgba(130,150,255,0.22)',
  specular: 'rgba(255,255,255,0.85)',
  // liquid buttons
  btnBorder: 'rgba(255,255,255,0.28)',
  btnFill: 'rgba(255,255,255,0.03)',
  btnRim: 'inset 0 1 1 rgba(255,255,255,0.72), inset 0 -10 18 rgba(255,255,255,0.08)',
  btnShadow: '0 10 30 rgba(0,0,0,0.45)',
  btnShadowSm: '0 6 16 rgba(0,0,0,0.40)',
  btnHighlight: ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0)'] as const,
  btnText: '#FFFFFF',
  orbs: ['rgba(124,92,255,0.55)', 'rgba(0,200,230,0.38)', 'rgba(255,77,141,0.28)'] as const,
};

export type Palette = Omit<typeof dark, 'isDark' | 'blurTint' | 'sheen' | 'orbs' | 'btnHighlight'> & {
  isDark: boolean;
  blurTint: 'dark' | 'light';
  sheen: readonly [string, string];
  orbs: readonly [string, string, string];
  btnHighlight: readonly [string, string];
};

const light: Palette = {
  isDark: false,
  bg: '#EEF0FB',
  text: '#13132B',
  muted: 'rgba(19,19,43,0.55)',
  accent: '#6A4CFF',
  accent2: '#0090B5',
  danger: '#F0366F',
  border: 'rgba(19,19,43,0.08)',
  radius: 22,
  blurTint: 'light',
  glassBlur: 'rgba(255,255,255,0.45)',
  glassSolid: 'rgba(255,255,255,0.80)',
  glassRow: 'rgba(255,255,255,0.62)',
  glassStroke: 'rgba(255,255,255,0.95)',
  sheen: ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.05)'],
  fill: 'rgba(19,19,43,0.06)',
  fillStrong: 'rgba(19,19,43,0.09)',
  pillStroke: 'rgba(19,19,43,0.10)',
  input: 'rgba(255,255,255,0.75)',
  activeRing: 'rgba(0,144,181,0.65)',
  dropShadow: '0 10 22 rgba(50,50,120,0.20)',
  dropRim: 'inset 0 1 1 rgba(255,255,255,1), inset 0 -1 1 rgba(255,255,255,0.7), inset 0 -10 16 -10 rgba(90,100,200,0.20)',
  specular: 'rgba(255,255,255,1)',
  btnBorder: 'rgba(255,255,255,0.95)',
  btnFill: 'rgba(255,255,255,0.38)',
  btnRim: 'inset 0 1 1 rgba(255,255,255,1), inset 0 -10 18 rgba(120,130,220,0.16)',
  btnShadow: '0 8 24 rgba(50,50,120,0.20)',
  btnShadowSm: '0 5 12 rgba(50,50,120,0.16)',
  btnHighlight: ['rgba(255,255,255,0.90)', 'rgba(255,255,255,0)'],
  btnText: '#13132B',
  orbs: ['rgba(124,92,255,0.32)', 'rgba(0,200,230,0.28)', 'rgba(255,77,141,0.20)'],
};

export const palettes = { dark: dark as Palette, light };

// Theme choice: follow the phone ('system') or force light/dark. Kept in a tiny module-level
// store (persisted) so every screen updates instantly without a provider.
export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'soundly.themeMode';
let mode: ThemeMode = 'system';
const listeners = new Set<() => void>();
// Also tell the OS, so native bits (keyboard, dialogs) match the chosen theme.
const emit = () => {
  try { Appearance.setColorScheme(mode === 'system' ? null : mode); } catch { }
  listeners.forEach((l) => l());
};

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === 'light' || v === 'dark' || v === 'system') { mode = v; emit(); }
  })
  .catch(() => { });

export function setThemeMode(next: ThemeMode) {
  mode = next;
  emit();
  AsyncStorage.setItem(KEY, next).catch(() => { });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getMode = () => mode;

export function useThemeMode() {
  const m = useSyncExternalStore(subscribe, getMode);
  const system = useColorScheme();
  const scheme: 'light' | 'dark' = m === 'system' ? (system === 'light' ? 'light' : 'dark') : m;
  return { mode: m, scheme, setMode: setThemeMode, toggle: () => setThemeMode(scheme === 'dark' ? 'light' : 'dark') };
}

// Returns a stable object per scheme, so it is safe in useMemo deps.
export function useTheme(): Palette {
  return palettes[useThemeMode().scheme];
}

export const GRADIENT = ['#7C5CFF', '#00B8D9'] as const;

// Layout rhythm: use these instead of magic numbers.
export const space = { xs: 6, sm: 10, md: 16, lg: 20, xl: 28 };
export const TAB_BAR_HEIGHT = 66;
export const MINI_PLAYER_HEIGHT = 100;
