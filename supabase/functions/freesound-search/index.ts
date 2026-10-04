// Freesound search for the app, so the Freesound API key stays on the server (an EXPO_PUBLIC_ key can
// be pulled out of the APK) and results are shared between all users: Freesound allows 2,000
// requests a day per key, so each query is fetched once and served from the freesound_cache table
// for 7 days.
//
// GET /functions/v1/freesound-search?q=bruh  ->  { results: [...] }  (same fields the app asks for)
//
// Secrets: FREESOUND_KEY. Deploy with "Verify JWT" OFF (the app's publishable key is not a JWT).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const API = 'https://freesound.org/apiv2/search/';
const FIELDS = 'id,name,username,duration,license,previews';
const MAX_SECONDS = 30;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' } });

Deno.serve(async (req) => {
  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
  if (!q) return json({ results: [] });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: hit } = await db.from('freesound_cache').select('results, fetched_at').eq('query', q).maybeSingle();
  if (hit && Date.now() - Date.parse(hit.fetched_at) < TTL_MS) return json({ results: hit.results });

  const key = Deno.env.get('FREESOUND_KEY');
  if (!key) return json({ error: 'not configured' }, 503);

  const params = new URLSearchParams({ query: q, filter: `duration:[0 TO ${MAX_SECONDS}]`, fields: FIELDS, page_size: '30', token: key });
  const res = await fetch(`${API}?${params}`);
  if (res.status === 429) {
    // out of quota for today: an old cached answer is better than none
    return hit ? json({ results: hit.results }) : json({ error: 'rate-limited' }, 429);
  }
  if (!res.ok) return hit ? json({ results: hit.results }) : json({ error: `freesound ${res.status}` }, 502);

  const body = await res.json();
  const results = Array.isArray(body?.results) ? body.results : [];
  await db.from('freesound_cache').upsert({ query: q, results, fetched_at: new Date().toISOString() });
  return json({ results });
});
