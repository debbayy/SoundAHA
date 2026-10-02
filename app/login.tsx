import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Palette, space, useTheme } from '../src/theme';
import { supabase } from '../src/lib/supabase';
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

  const submit = async () => {
    setBusy(true);
    const { error } = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return Alert.alert('Oops', error.message);
    if (signup) Alert.alert('Check your email', 'Confirm your email, then log in.');
    else router.back();
  };

  return (
    <Backdrop>
      <SafeAreaView style={s.screen}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <LiquidButton compact hitSlop={10} style={s.close} wrapStyle={{ alignSelf: 'flex-end' }} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close">
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
                <TextInput style={s.field} placeholder="••••••••" placeholderTextColor={t.muted} secureTextEntry={!show} value={password} onChangeText={setPassword} selectionColor={t.accent2} />
                <Pressable onPress={() => setShow(!show)} hitSlop={10}><Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={t.muted} /></Pressable>
              </View>
              <GlassButton label={signup ? 'Sign up' : 'Login'} onPress={submit} busy={busy} disabled={!email || !password} style={{ marginTop: space.lg }} />
            </View>
          </Glass>

          <Pressable onPress={() => setSignup(!signup)} style={{ marginTop: space.lg }}>
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
});
