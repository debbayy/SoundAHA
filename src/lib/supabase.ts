import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://localhost';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'anon';

export const supabaseReady = !!process.env.EXPO_PUBLIC_SUPABASE_URL;

export const supabase = createClient(url, key, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
