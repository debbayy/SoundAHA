import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../src/theme';
import { supabase } from '../src/lib/supabase';
import { useAuth } from '../src/context/AuthContext';
import { Backdrop } from '../src/components/Backdrop';
import { Glass } from '../src/components/Glass';
import { GlassButton } from '../src/components/GlassButton';

const MIN_PASSWORD = 8;

// Opened from the "reset password" email link (see lib/useAuthLinks.ts), which has already signed
// the user in for this one purpose.
export default function ResetPassword() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { session } = useAuth();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) setError(e.message);
    else setDone(true);
  };

  return (
    <Backdrop>
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center' }}>
          <View style={s.head}>
            <Text style={{ fontSize: 48 }}>🔑</Text>
            <Text style={s.h}>{done ? 'Password changed' : 'New password'}</Text>
            <Text style={s.muted}>{done ? "You're logged in with your new password." : session ? session.user.email : 'Opening your reset link…'}</Text>
          </View>
          {done ? (
            <GlassButton label="Continue" onPress={leave} />
          ) : (
            <Glass radius={28} intensity={50}>
              <View style={s.form}>
                <View style={s.input}>
                  <TextInput
                    style={s.field}
                    placeholder={`At least ${MIN_PASSWORD} characters`}
                    placeholderTextColor={t.muted}
                    secureTextEntry={!show}
                    value={password}
                    onChangeText={setPassword}
                    selectionColor={t.accent2}
                    autoFocus
                  />
                  <Pressable onPress={() => setShow(!show)} hitSlop={10}><Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={t.muted} /></Pressable>
                </View>
                {error && <Text style={s.error}>{error}</Text>}
                <GlassButton label="Save password" onPress={submit} busy={busy} disabled={!session || password.length < MIN_PASSWORD} style={{ marginTop: space.lg }} />
                <Pressable onPress={leave} style={{ marginTop: space.md }} hitSlop={8}>
                  <Text style={[s.muted, { textAlign: 'center' }]}>Cancel</Text>
                </Pressable>
              </View>
            </Glass>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Backdrop>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1, padding: space.lg },
  head: { alignItems: 'center', marginBottom: space.xl },
  h: { fontSize: 28, fontWeight: '800', color: t.text, marginTop: space.sm, letterSpacing: -0.5 },
  muted: { color: t.muted, marginTop: 4 },
  form: { padding: space.lg },
  input: { flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.input, borderWidth: StyleSheet.hairlineWidth * 1.5, borderColor: t.border },
  field: { flex: 1, color: t.text, fontSize: 16 },
  error: { color: t.danger, marginTop: space.sm, fontSize: 13 },
});
