import { Sound } from '../types';

// Built-in default sounds: synthesized by scripts/generate-sounds.js, except hidup-jokowi.mp3
// (downloaded from myinstants.com).
// They play offline and are used until the `sounds` table in Supabase has rows.
export const SEED: Sound[] = [
  { id: '1', title: 'Bruh Sound', category: 'meme', emoji: '😂', duration: 1, audio_url: '', audio_source: require('../../assets/sounds/bruh.wav') },
  { id: '2', title: 'Vine Boom', category: 'trending', emoji: '🔥', duration: 2, audio_url: '', audio_source: require('../../assets/sounds/vine-boom.wav') },
  { id: '3', title: 'Laugh Track', category: 'meme', emoji: '🤣', duration: 2, audio_url: '', audio_source: require('../../assets/sounds/laugh-track.wav') },
  { id: '4', title: 'Applause', category: 'meme', emoji: '👏', duration: 4, audio_url: '', audio_source: require('../../assets/sounds/applause.wav') },
  { id: '6', title: 'Hidup Jokowi', category: 'meme', emoji: '🇮🇩', duration: 2, audio_url: '', audio_source: require('../../assets/sounds/hidup-jokowi.mp3') },
  { id: '5', title: 'Chill Loop', category: 'music', emoji: '🎵', duration: 16, audio_url: '', audio_source: require('../../assets/sounds/chill-loop.wav') },
];
