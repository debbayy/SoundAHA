// Removes party files older than 6 hours from the private "party" bucket: whatever a phone could not
// clean up itself (app closed or crashed mid-party). Called every hour by pg_cron, see
// supabase/party-cleanup-schedule.sql.
//
// Deploy with "Verify JWT" turned OFF (the project's publishable key is not a JWT); requests are
// checked against the CLEANUP_SECRET function secret instead.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'party';
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const PAGE = 1000;

Deno.serve(async (req) => {
  const secret = Deno.env.get('CLEANUP_SECRET');
  if (!secret || req.headers.get('x-cleanup-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const bucket = supabase.storage.from(BUCKET);
  const cutoff = Date.now() - MAX_AGE_MS;
  const old: string[] = [];

  // Layout: <user id>/<party code>/<file>. Folders come back from list() with a null id.
  const walk = async (prefix: string, depth: number): Promise<void> => {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await bucket.list(prefix, { limit: PAGE, offset });
      if (error) throw error;
      for (const item of data) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) {
          if (depth < 2) await walk(path, depth + 1);
        } else if (Date.parse(item.created_at) < cutoff) {
          old.push(path);
        }
      }
      if (data.length < PAGE) return;
    }
  };

  try {
    await walk('', 0);
    for (let i = 0; i < old.length; i += 100) {
      const { error } = await bucket.remove(old.slice(i, i + 100));
      if (error) throw error;
    }
    return Response.json({ removed: old.length });
  } catch (e) {
    console.error('[party-cleanup]', e);
    return Response.json({ error: String(e), removed: 0 }, { status: 500 });
  }
});
