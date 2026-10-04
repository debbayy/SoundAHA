import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../src/theme';
import { supabase } from '../src/lib/supabase';
import { confirmRedirect, resetRedirect } from '../src/lib/useAuthLinks';
import { useAuth } from '../src/context/AuthContext';

const MIN_PASSWORD = 8;
import { Backdrop } from '../src/components/Backdrop';
import { Glass } from '../src/components/Glass';
import { GlassButton } from '../src/components/GlassButton';
import { LiquidButton } from '../src/components/LiquidButton';

export default function Login() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false); // login refused until the email is confirmed
  const { session } = useAuth();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // logged in (here, or by tapping the confirmation link in the email): done
  useEffect(() => { if (session) leave(); }, [session]);

  const submit = async () => {
    setBusy(true);
    setUnconfirmed(false);
    const { error } = signup
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: confirmRedirect() } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      if (error.code === 'email_not_confirmed') { setUnconfirmed(true); return; }
      return Alert.alert('Oops', error.message);
    }
    if (signup) Alert.alert('Check your email', 'Tap the link in the email we sent to confirm your account. It opens the app and logs you in.');
  };

  const resend = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: confirmRedirect() } });
    setBusy(false);
    Alert.alert(error ? 'Oops' : 'Email sent', error ? error.message : 'Check your inbox (and spam) for the new confirmation link.');
  };

  const forgot = async () => {
    if (!email.trim()) return Alert.alert('Enter your email', 'Type the email of your account first, then tap "Forgot password?" again.');
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirect() });
    setBusy(false);
    Alert.alert(error ? 'Oops' : 'Email sent', error ? error.message : 'Tap the link in the email to choose a new password. It opens the app.');
  };

  const tooShort = signup && password.length < MIN_PASSWORD;

  return (
    <Backdrop>
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <LiquidButton compact hitSlop={10} style={s.close} wrapStyle={{ alignSelf: 'flex-end' }} onPress={leave} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={t.btnText} />
          </LiquidButton>
          <View style={s.head}>
            <Text style={{ fontSize: 48 }}>🔊</Text>
            <Text style={s.h}>{signup ? 'Create account' : 'Welcome back'}</Text>
            <Text style={s.muted}>Save your favorite sounds</Text>
          </View>

          <Glass radius={28} intensity={50}>
            <View style={s.form}>
              <Text style={s.label}>Email</Text>
              <View style={s.input}>
                <TextInput style={s.field} placeholder="Enter your email" placeholderTextColor={t.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} selectionColor={t.accent2} />
              </View>
              <Text style={s.label}>Password</Text>
              <View style={s.input}>
                <TextInput style={s.field} placeholder={signup ? `At least ${MIN_PASSWORD} characters` : '••••••••'} placeholderTextColor={t.muted} secureTextEntry={!show} value={password} onChangeText={setPassword} selectionColor={t.accent2} />
                <Pressable onPress={() => setShow(!show)} hitSlop={10}><Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={t.muted} /></Pressable>
              </View>
              {unconfirmed && (
                <View style={s.notice}>
                  <Text style={s.noticeText}>Confirm your email first: tap the link we sent you.</Text>
                  <Pressable onPress={resend} disabled={busy} hitSlop={8}><Text style={s.link}>Resend email</Text></Pressable>
                </View>
              )}
              <GlassButton label={signup ? 'Sign up' : 'Login'} onPress={submit} busy={busy} disabled={!email || !password || tooShort} style={{ marginTop: space.lg }} />
              {!signup && (
                <Pressable onPress={forgot} disabled={busy} hitSlop={8} style={{ marginTop: space.md, alignSelf: 'center' }}>
                  <Text style={s.link}>Forgot password?</Text>
                </Pressable>
              )}
            </View>
          </Glass>

          <Pressable onPress={() => { setSignup(!signup); setUnconfirmed(false); }} style={{ marginTop: space.lg }}>
            <Text style={[s.muted, { textAlign: 'center' }]}>{signup ? 'Already have an account? Login' : "Don't have an account? Sign up"}</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Backdrop>
  );
}

const makeStyles = (t: Palette) => StyleSheet.create({
  screen: { flex: 1, padding: space.lg },
  close: { width: 38, height: 38 },
  head: { alignItems: 'center', marginVertical: space.xl },
  h: { fontSize: 28, fontWeight: '800', color: t.text, marginTop: space.sm, letterSpacing: -0.5 },
  muted: { color: t.muted, marginTop: 4 },
  form: { padding: space.lg },
  label: { color: t.text, fontWeight: '600', marginBottom: 6, marginTop: space.sm },
  input: { flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.input, borderWidth: StyleSheet.hairlineWidth * 1.5, borderColor: t.border },
  field: { flex: 1, color: t.text, fontSize: 16 },
  notice: { marginTop: space.md, gap: 6 },
  noticeText: { color: t.text, fontSize: 13 },
  link: { color: t.accent2, fontSize: 14, fontWeight: '700' },
});
