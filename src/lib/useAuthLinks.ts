import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';
import { parseAuthLink } from './authLinks';

// Where auth emails send people back to (must be listed under Authentication → URL Configuration →
// Redirect URLs in Supabase; see supabase/README.md). createURL gives soundly://… in a release build
// and exp://…/--/… in Expo Go.
export const confirmRedirect = () => Linking.createURL('login');
export const resetRedirect = () => Linking.createURL('reset-password');

// Signs the user in from an email link that opened the app; a password-reset link then lands on the
// screen for choosing a new password.
export function useAuthLinks() {
  const router = useRouter();
  const url = Linking.useURL();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!url || handled.current === url) return;
    const link = parseAuthLink(url);
    if (!link) return;
    handled.current = url;
    (async () => {
      if (link.kind === 'error') {
        Alert.alert('Link expired', `${link.message}. Ask for a new email and use the newest link.`);
        return;
      }
      const { error } = link.kind === 'session'
        ? await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
        : await supabase.auth.exchangeCodeForSession(link.code);
      if (error) { Alert.alert('Link expired', 'Ask for a new email and use the newest link.'); return; }
      if (link.kind === 'session' && link.type === 'recovery') router.replace('/reset-password');
    })();
  }, [url]);
}
