import { parseAuthLink } from '../authLinks';

describe('parseAuthLink', () => {
  it('ignores ordinary links', () => {
    expect(parseAuthLink(null)).toBeNull();
    expect(parseAuthLink('soundly://player')).toBeNull();
    expect(parseAuthLink('soundly://login?foo=1')).toBeNull();
  });

  it('reads a session from the fragment (confirm / recovery links)', () => {
    expect(parseAuthLink('soundly://reset-password#access_token=AT&refresh_token=RT&expires_in=3600&type=recovery')).toEqual({
      kind: 'session', accessToken: 'AT', refreshToken: 'RT', type: 'recovery',
    });
    expect(parseAuthLink('exp://192.168.1.2:8081/--/login#access_token=A&refresh_token=R&type=signup')).toMatchObject({ kind: 'session', type: 'signup' });
  });

  it('reads a PKCE code from the query', () => {
    expect(parseAuthLink('soundly://login?code=abc123')).toEqual({ kind: 'code', code: 'abc123' });
  });

  it('reports expired / used links', () => {
    expect(parseAuthLink('soundly://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toEqual({ kind: 'error', message: 'Email link is invalid or has expired' });
  });
});
