import { Sound } from '../types';

// Fallback data so the UI works before Supabase is set up.
// Replace audio_url with files you own / have licensed (Supabase Storage public URLs).
export const SEED: Sound[] = [
  { id: '1', title: 'Bruh Sound', category: 'meme', emoji: '😂', duration: 3, audio_url: '' },
  { id: '2', title: 'Vine Boom', category: 'trending', emoji: '🔥', duration: 2, audio_url: '' },
  { id: '3', title: 'Laugh Track', category: 'meme', emoji: '🤣', duration: 4, audio_url: '' },
  { id: '4', title: 'Applause', category: 'meme', emoji: '👏', duration: 5, audio_url: '' },
  { id: '5', title: 'Chill Loop', category: 'music', emoji: '🎵', duration: 30, audio_url: '' },
];
