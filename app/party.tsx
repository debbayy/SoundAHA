import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../src/theme';
import { useParty } from '../src/context/PartyContext';
import { CODE_LENGTH, isValidCode, MAX_MEMBERS, normalizeCode } from '../src/lib/party';
import { Backdrop } from '../src/components/Backdrop';
import { LiquidButton } from '../src/components/LiquidButton';
import { GlassButton } from '../src/components/GlassButton';
import { Glass } from '../src/components/Glass';

// Start or join a party: phones in the same party play the same song at the same moment.
export default function PartyScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { phase, code, isHost, members, busy, message, shareBlocked, name, setName, start, join, leave } = useParty();
  const [input, setInput] = useState('');
  const typed = normalizeCode(input);
  const live = phase === 'live' || phase === 'connecting';

  const shareCode = () => {
    if (!code) return;
    Haptics.selectionAsync().catch(() => {});
    Share.share({ message: `Join my Soundly party! Open Soundly → Party → Join, and enter: ${code}` }).catch(() => {});
  };

  return (
    <Backdrop>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.top, { paddingTop: insets.top + space.sm }]}>
          <LiquidButton compact hitSlop={10} style={s.round} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="chevron-down" size={24} color={t.btnText} />
          </LiquidButton>
          <Text style={s.heading}>Party</Text>
          <View style={s.round} />
        </View>

        <ScrollView contentContainerStyle={[s.body, { paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
          {live ? (
            <>
              <Glass radius={28} intensity={50}>
                <View style={s.codeCard}>
                  <Text style={s.label}>{phase === 'connecting' ? 'CONNECTING…' : 'PARTY CODE'}</Text>
                  <Text style={s.code} selectable>{code}</Text>
                  <GlassButton variant="glass" label="Share code" onPress={shareCode} style={{ alignSelf: 'stretch', marginTop: space.md }} />
                </View>
              </Glass>

              {shareBlocked && !busy && (
                <View style={s.blocked}>
                  <Ionicons name="alert-circle" size={18} color={t.danger} />
                  <Text style={s.blockedText}>
                    {shareBlocked === 'login'
                      ? 'This song is from your phone. Log in to send it to the party; for now it only plays here.'
                      : shareBlocked === 'tooBig'
                        ? 'This song is bigger than 10 MB, so it only plays on your phone. Pick a smaller file to share it.'
                        : "Couldn't send this song to the party. Check your connection and try again."}
                  </Text>
                </View>
              )}
              {shareBlocked === 'login' && !busy && (
                <GlassButton label="Log in" onPress={() => router.push('/login')} style={{ marginTop: space.sm }} />
              )}

              {busy && (
                <View style={s.busy}>
                  <ActivityIndicator color={t.accent2} />
                  <Text style={s.busyText}>{busy === 'uploading' ? 'Sending the song to the party…' : 'Getting the song…'}</Text>
                </View>
              )}

              <Text style={[s.label, { marginTop: space.lg }]}>{`IN THE PARTY · ${members.length}/${MAX_MEMBERS}`}</Text>
              {members.map((m) => (
                <View key={m.id} style={s.member}>
                  <View style={s.avatar}><Text style={s.avatarText}>{(m.name[0] ?? '?').toUpperCase()}</Text></View>
                  <Text style={s.memberName} numberOfLines={1}>{m.name}</Text>
                  {m.host && <Text style={s.hostTag}>HOST</Text>}
                </View>
              ))}

              <Text style={s.hint}>
                Everyone in the party can play, pause, skip and seek; all phones follow. Songs from your phone are sent to the others automatically (you need to be logged in for that).
              </Text>
              <GlassButton
                variant="glass"
                label={isHost ? 'End party' : 'Leave party'}
                onPress={() => { leave(); }}
                style={{ marginTop: space.lg }}
              />
              {isHost && <Text style={s.small}>Ending the party stops it for everyone.</Text>}
            </>
          ) : (
            <>
              <Text style={s.intro}>🎉 Play the same song at the same moment on several phones.</Text>
              {message && <Text style={[s.notice, phase === 'error' && { color: t.danger }]}>{message}</Text>}

              <Text style={s.label}>YOUR NAME</Text>
              <TextInput
                style={s.input}
                value={name}
                onChangeText={setName}
                placeholder="How others see you"
                placeholderTextColor={t.muted}
                selectionColor={t.accent2}
                maxLength={24}
              />

              <GlassButton label="Start a party" onPress={() => { Haptics.selectionAsync().catch(() => {}); start(); }} style={{ marginTop: space.lg }} />

              <Text style={[s.label, { marginTop: space.xl }]}>JOIN A PARTY</Text>
              <View style={s.joinRow}>
                <TextInput
                  style={[s.input, s.codeInput]}
                  value={typed}
                  onChangeText={setInput}
                  placeholder="CODE"
                  placeholderTextColor={t.muted}
                  selectionColor={t.accent2}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={CODE_LENGTH + 4}
                  returnKeyType="go"
                  onSubmitEditing={() => isValidCode(typed) && join(typed)}
                />
                <GlassButton label="Join" disabled={!isValidCode(typed)} onPress={() => join(typed)} style={{ width: 96 }} />
              </View>
              <Text style={s.small}>Needs an internet connection on every phone.</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Backdrop>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: space.sm },
    round: { width: 44, height: 44 },
    heading: { fontSize: 18, fontWeight: '800', color: t.text },
    body: { paddingHorizontal: space.lg, paddingTop: space.md },
    intro: { fontSize: 16, fontWeight: '600', color: t.text, textAlign: 'center', marginBottom: space.lg, lineHeight: 22 },
    notice: { fontSize: 14, color: t.muted, textAlign: 'center', marginBottom: space.lg },
    label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: t.muted, marginBottom: space.sm },
    input: { height: 50, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: t.text, backgroundColor: t.fillStrong },
    joinRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    codeInput: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: 4, textAlign: 'center' },
    small: { fontSize: 12, color: t.muted, textAlign: 'center', marginTop: space.sm },
    codeCard: { alignItems: 'center', padding: space.xl },
    code: { fontSize: 44, fontWeight: '900', letterSpacing: 8, color: t.text, marginTop: space.xs },
    busy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: space.lg },
    busyText: { color: t.muted, fontSize: 13 },
    member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: t.fillStrong },
    avatarText: { fontSize: 16, fontWeight: '800', color: t.text },
    memberName: { flex: 1, fontSize: 16, fontWeight: '600', color: t.text },
    hostTag: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: t.accent2 },
    blocked: { flexDirection: "row", gap: 8, alignItems: "flex-start", marginTop: space.lg, padding: space.md, borderRadius: 16, backgroundColor: t.fillStrong },
    blockedText: { flex: 1, fontSize: 13, color: t.text, lineHeight: 19 },
    hint: { fontSize: 13, color: t.muted, lineHeight: 19, marginTop: space.lg },
  });
