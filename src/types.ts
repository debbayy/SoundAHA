export type Sound = {
  id: string;
  title: string;
  category: 'meme' | 'music' | 'trending';
  audio_url: string;
  thumbnail_url?: string | null;
  emoji?: string;
  duration: number; // seconds
  is_featured?: boolean;
};
