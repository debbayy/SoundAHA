// Links in auth emails (confirm sign-up, reset password) open the app through the soundly:// scheme
// instead of a web page. Supabase puts the session in the link: as #access_token=…&refresh_token=…
// (implicit flow) or ?code=… (PKCE), or #error_description=… when the link is expired / used.

export type AuthLink =
  | { kind: 'session'; accessToken: string; refreshToken: string; type: string | null }
  | { kind: 'code'; code: string }
  | { kind: 'error'; message: string }
  | null;

export function parseAuthLink(url: string | null | undefined): AuthLink {
  if (!url) return null;
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const hash = new URLSearchParams(hashAt >= 0 ? url.slice(hashAt + 1) : '');
  const query = new URLSearchParams(queryAt >= 0 ? url.slice(queryAt + 1, hashAt >= 0 && hashAt > queryAt ? hashAt : undefined) : '');
  const get = (k: string) => hash.get(k) ?? query.get(k);

  const err = get('error_description') ?? get('error');
  if (err) return { kind: 'error', message: err.replace(/\+/g, ' ') };
  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  if (accessToken && refreshToken) return { kind: 'session', accessToken, refreshToken, type: get('type') };
  const code = query.get('code');
  if (code) return { kind: 'code', code };
  return null;
}
