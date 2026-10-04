# SoundAHA (Expo + Supabase)

```bash
npm install
npx expo install --fix      # aligns package versions with your Expo SDK
cp .env.example .env        # fill in Supabase URL + anon key
npx expo start
```
1. Run `supabase.sql` in the Supabase SQL editor.
2. Upload your own/licensed audio to Storage, then insert rows into `sounds`.
3. Without Supabase env vars the app runs on `src/data/seed.ts` (silent placeholders).
# SoundAHA
