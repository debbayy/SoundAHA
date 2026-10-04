import { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../../src/theme';
import { Glass } from '../../src/components/Glass';
import { GlassButton } from '../../src/components/GlassButton';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { ThemePicker } from '../../src/components/ThemeToggle';
import { useAuth } from '../../src/context/AuthContext';
import { useParty } from '../../src/context/PartyContext';
import { supabase } from '../../src/lib/supabase';
import { deleteMyAccount } from '../../src/lib/account';
import { legalReady, PRIVACY_URL, TERMS_URL } from '../../src/lib/links';
import { useBottomSpace } from '../../src/lib/useBottomSpace';

export default function Profile() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const { session } = useAuth();
  const party = useParty();
  const router = useRouter();
  const bottom = useBottomSpace();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const doDelete = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      if (party.phase === 'live') party.leave();
      await deleteMyAccount();
      setNotice({ title: 'Account deleted', message: 'Your account and its synced data were deleted. Songs and playlists on this phone stay here.' });
    } catch (e) {
      console.warn('[account] delete failed', e);
      setNotice({ title: "Couldn't delete account", message: 'Check your internet connection and try again.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false}>
        <Glass radius={32} intensity={50} style={{ alignSelf: 'stretch' }}>
          <View style={s.card}>
            <Text style={{ fontSize: 56 }}>👤</Text>
            <Text style={s.h}>{session ? session.user.email : 'Guest'}</Text>
            <Text style={s.muted}>{session ? 'Your favorites are synced' : 'Login to sync favorites'}</Text>
            <Text style={s.section}>PARTY</Text>
            <GlassButton
              variant={party.phase === 'live' ? 'primary' : 'glass'}
              label={party.phase === 'live' ? `🎉 In party ${party.code} · ${party.members.length}` : '🎉 Party: listen together'}
              onPress={() => router.push('/party')}
              style={{ alignSelf: 'stretch' }}
            />
            <Text style={s.section}>APPEARANCE</Text>
            <ThemePicker />
            {session ? (
              <>
                <GlassButton variant="glass" label="Log out" onPress={() => supabase.auth.signOut()} style={s.btn} />
                <Pressable onPress={() => setConfirmDelete(true)} disabled={deleting} hitSlop={8} style={s.danger} accessibilityRole="button">
                  <Text style={s.dangerText}>{deleting ? 'Deleting account…' : 'Delete account'}</Text>
                </Pressable>
              </>
            ) : (
              <GlassButton label="Login" onPress={() => router.push('/login')} style={s.btn} />
            )}
          </View>
        </Glass>

        {legalReady && (
          <View style={s.links}>
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8} accessibilityRole="link">
              <Text style={s.link}>Privacy Policy</Text>
            </Pressable>
            <Text style={s.dot}>·</Text>
            <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8} accessibilityRole="link">
              <Text style={s.link}>Terms of Service</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete account?"
        message="This permanently deletes your account and its synced favorites. It can't be undone. Songs and playlists on this phone are kept."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        visible={!!notice}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        confirmLabel="OK"
        hideCancel
        onConfirm={() => setNotice(null)}
        onCancel={() => setNotice(null)}
      />
    </SafeAreaView>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: space.lg, paddingTop: space.lg },
  card: { alignItems: 'center', padding: space.xl },
  h: { fontSize: 20, fontWeight: '700', color: t.text, marginTop: space.sm },
  muted: { color: t.muted, marginTop: 4 },
  section: { color: t.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginTop: space.xl, marginBottom: space.sm, alignSelf: 'flex-start' },
  btn: { marginTop: space.lg, alignSelf: 'stretch' },
  danger: { marginTop: space.md, paddingVertical: 6 },
  dangerText: { color: t.danger, fontSize: 14, fontWeight: '700' },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: space.lg },
  link: { color: t.muted, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  dot: { color: t.muted, fontSize: 12 },
});
