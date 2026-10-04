import { supabase } from './supabase';

// Deletes the logged-in user's account and everything the server holds for it (Google Play requires
// this to be possible inside the app). The user row goes through the delete_my_account() database
// function (see supabase.sql), which can only ever delete the caller; favorites go with it. Party
// files are removed here first, through the storage API (the hourly cleanup catches any leftovers).
// Data kept only on this phone (imports, playlists, local favorites) is not touched.
export async function deleteMyAccount(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  try {
    const bucket = supabase.storage.from('party');
    const { data: parties } = await bucket.list(user.id, { limit: 1000 });
    for (const p of parties ?? []) {
      const { data: files } = await bucket.list(`${user.id}/${p.name}`, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${user.id}/${p.name}/${f.name}`);
      if (paths.length) await bucket.remove(paths);
    }
  } catch (e) {
    console.warn('[account] party files not removed; the scheduled cleanup will', e);
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {}); // the session belongs to a deleted user now
}
