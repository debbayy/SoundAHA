import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../src/theme';
import { supabase } from '../src/lib/supabase';

export default function Login() {
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
    <SafeAreaView style={s.screen}>
      <Pressable onPress={() => router.back()} style={{ alignSelf: 'flex-end' }}><Ionicons name="close" size={26} color={theme.text} /></Pressable>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <Text style={{ fontSize: 48 }}>🔊</Text>
        <Text style={s.h}>{signup ? 'Create account' : 'Welcome back'}</Text>
        <Text style={s.muted}>Save your favorite sounds</Text>
      </View>

      <Text style={s.label}>Email</Text>
      <TextInput style={s.input} placeholder="Enter your email" placeholderTextColor={theme.muted} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Text style={s.label}>Password</Text>
      <View style={s.input}>
        <TextInput style={{ flex: 1, color: theme.text }} placeholder="••••••••" placeholderTextColor={theme.muted} secureTextEntry={!show} value={password} onChangeText={setPassword} />
        <Pressable onPress={() => setShow(!show)}><Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={theme.muted} /></Pressable>
      </View>

      <Pressable style={s.btn} onPress={submit} disabled={busy || !email || !password}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{signup ? 'Sign up' : 'Login'}</Text>}
      </Pressable>
      <Pressable onPress={() => setSignup(!signup)} style={{ marginTop: 20 }}>
        <Text style={[s.muted, { textAlign: 'center' }]}>{signup ? 'Already have an account? Login' : "Don't have an account? Sign up"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 24 },
  h: { fontSize: 26, fontWeight: '800', color: theme.text, marginTop: 8 },
  muted: { color: theme.muted, marginTop: 4 },
  label: { color: theme.text, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: 14, borderRadius: theme.radius, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, color: theme.text },
  btn: { marginTop: 24, height: 52, borderRadius: theme.radius, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
