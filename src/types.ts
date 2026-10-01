export type Sound = {
  id: string;
  title: string;
  category: 'meme' | 'music' | 'trending' | 'local';
  local?: boolean; // imported from the phone; not in Supabase, so it can't be favorited
  audio_url: string;
  audio_source?: number; // bundled asset (require()), used by built-in default sounds
  thumbnail_url?: string | null;
  emoji?: string;
  duration: number; // seconds
  is_featured?: boolean;
};
