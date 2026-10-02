export type Sound = {
  id: string;
  title: string;
  category: 'meme' | 'music' | 'trending' | 'local';
  local?: boolean; // imported from the phone; not in Supabase, so it can't be favorited
  audio_url: string;
  audio_source?: number; // bundled asset (require()), used by built-in default sounds
  thumbnail_url?: string | null;
  artist?: string; // from the file's tags (imported songs)
  album?: string;
  cover_url?: string; // cover art extracted from the file's tags
  fingerprint?: string; // identity of the file's contents, used to refuse importing the same song twice
  meta_checked?: boolean; // tags were already read for this imported file
  emoji?: string;
  duration: number; // seconds
  is_featured?: boolean;
};
