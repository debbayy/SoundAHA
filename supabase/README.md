# Supabase setup (free plan, ready for Play Store)

The app is built so the **Supabase Free plan is enough and can never bill you**: on the Free plan,
going over a limit restricts the service instead of charging. Everything important (playback,
imports, favorites, playlists, history) works on the phone without the server; server features fail
politely when the project is limited.

Do these steps once, in order, in the Supabase dashboard.

## 1. Billing safety
- **Organization → Billing**: stay on the **Free** plan. If you ever move to Pro, keep **Spend Cap ON**.
- **Organization → Usage**: check now and then; Supabase emails you when you get close to a limit.

## 2. Database
**SQL Editor** → paste and run the whole [`../supabase.sql`](../supabase.sql). It creates:
- `sounds` (catalog) and `favorites` tables with row-level security,
- the private `party` storage bucket (audio only, 10 MB, 30 files per user, owner-only access),
- `delete_my_account()` (in-app account deletion, required by Google Play),
- `freesound_cache` (shared search results).

> The `sounds` table did not exist yet, so the app has been using its built-in sounds. Favorites
> sync starts working once this script has run.

## 3. Edge Functions
**Edge Functions → Deploy a new function** (via the editor), once per folder below. For both, turn
**Verify JWT OFF** (the app's publishable key is not a JWT).

| Function | Code | Secrets (Edge Functions → Secrets) |
|---|---|---|
| `freesound-search` | [`functions/freesound-search/index.ts`](functions/freesound-search/index.ts) | `FREESOUND_KEY` = your Freesound API key |
| `party-cleanup` | [`functions/party-cleanup/index.ts`](functions/party-cleanup/index.ts) | `CLEANUP_SECRET` = a long random string |

Then remove `EXPO_PUBLIC_FREESOUND_KEY` from `.env` (and from EAS environment variables if you put
it there): the app no longer reads it, and anything `EXPO_PUBLIC_` ends up readable inside the APK.

## 4. Hourly cleanup of party files
1. **Database → Extensions**: enable `pg_cron` and `pg_net`.
2. **SQL Editor**: open [`party-cleanup-schedule.sql`](party-cleanup-schedule.sql), put your
   `CLEANUP_SECRET` in place of `<CLEANUP_SECRET>`, run it.
3. Check later: `select * from cron.job_run_details order by start_time desc limit 5;`

## 5. Auth: emails that arrive, links that open the app, no bots

### 5a. Your own email sender (required before release)
Supabase's built-in email only delivers to your project's team members and a few per hour, so
**ordinary users (and Google's reviewers) would never get the confirmation email and could not log
in.** Use a free SMTP provider:
1. Create a free account at e.g. **Resend** (3,000 emails/month) or **Brevo** (300/day) and verify a
   sending domain or address there.
2. **Authentication → Emails → SMTP Settings**: enable custom SMTP and fill in the host, port, user,
   password and sender address from that provider.
3. **Authentication → Rate Limits**: raise "emails per hour" to what your provider allows.

### 5b. Links in emails open the app
**Authentication → URL Configuration**
- **Site URL**: your published docs page, e.g. `https://<github-user>.github.io/<repo>` (where links
  land if they can't open the app).
- **Redirect URLs**, add both:
  - `soundly://**` (release builds)
  - `exp://**` (testing in Expo Go)

The app sends people back to `soundly://login` (confirm sign-up: logs them in) and
`soundly://reset-password` (choose a new password), see `src/lib/useAuthLinks.ts`.

### 5c. Keep bots out (protects the 50,000 monthly-user limit)
**Authentication → Sign In / Providers**
- Email provider: **Confirm email ON**; minimum password length **8** (the app asks for 8 too).
- **Allow anonymous sign-ins OFF**.
- **Rate limits**: keep sign-ups per hour low.

A captcha would need `react-native-webview` (a native library that grows the APK), so it was left
out on purpose; confirmation emails plus rate limits cover the common abuse.

### 5d. A login for Google's reviewers
Play Console → **App content → App access**: say that some features need an account and give a
working test login (create it under **Authentication → Users → Add user**, with "Auto Confirm User").

## 6. Public pages for the Play Store
The [`../docs`](../docs) folder has the Privacy Policy, Terms of Service and account deletion page.
1. Replace `CONTACT_EMAIL` and `[Developer name]` in every file in `docs/`.
2. GitHub repo → **Settings → Pages** → branch `main`, folder `/docs`.
3. Set `EXPO_PUBLIC_LEGAL_URL=https://<github-user>.github.io/<repo>` in `.env` and in the EAS
   environment, so the app's Profile tab links to them.
4. Play Console: use `…/privacy.html` as the privacy policy URL and `…/delete-account.html` as the
   account deletion URL; fill in the Data safety form to match the privacy policy.

## 7. Catalog audio (optional, saves the most bandwidth)
The Free plan has 5 GB of egress a month. To keep catalog audio off it, host the files somewhere
without bandwidth charges (e.g. Cloudflare R2, GitHub Releases) and put those `https://` links in
`sounds.audio_url`. You can also publish the whole catalog as a static JSON array and set
`EXPO_PUBLIC_CATALOG_URL` to it; then the list never touches Supabase. Either way the app refreshes
the list at most once a day and keeps every played song on the phone, so replays cost nothing.

## Hard limits of the Free plan to know about
- **Realtime: 200 connections at once** → at most ~200 people in parties at the same moment
  (8 per party). Beyond that, Party shows "unavailable, try again later"; the rest of the app is fine.
- **Edge Functions: 500,000 calls a month** → online search stops for the month when used up
  (each phone also remembers its last 40 searches for a week).
- **Auth: 50,000 monthly active users** → logins are limited past that; the app works without one.

If the app grows past these, the realistic path is ads or a premium tier paying for the Pro plan,
with Spend Cap on.
