import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Palette, space, useTheme } from '../src/theme';
import { usePlayer, useProgress } from '../src/context/PlayerContext';
import { Backdrop } from '../src/components/Backdrop';
import { LiquidButton } from '../src/components/LiquidButton';
import { SeekBar } from '../src/components/SeekBar';
import { SpeedDialog } from '../src/components/SpeedDialog';
import { Vinyl } from '../src/components/Vinyl';
import { coverOf } from '../src/components/SoundArt';
import { BRAND_TINT } from '../src/components/tints';

const CATEGORY: Record<string, string> = { meme: 'Meme', music: 'Music', trending: 'Trending', local: 'My Sounds' };

// Full-screen player: spinning record with the cover art, title / artist, timeline and controls.
export default function Player() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { current, playing, toggle, rate, setRate, seekTo } = usePlayer();
  const { position } = useProgress();
  const [speedOpen, setSpeedOpen] = useState(false);

  // Nothing loaded (e.g. the song was just deleted): there is nothing to show.
  useEffect(() => {
    if (!current) router.back();
  }, [current]);
  if (!current) return null;

  const cover = coverOf(current);
  const disc = Math.min(width - 56, height * 0.4, 360);
  const artist = current.artist || CATEGORY[current.category] || 'Soundly';

  return (
    <Backdrop>
      {cover && (
        <>
          <Image source={{ uri: cover }} blurRadius={45} resizeMode="cover" style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.4 }] }]} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.isDark ? 'rgba(5,5,12,0.62)' : 'rgba(238,240,251,0.7)' }]} />
        </>
      )}
      <SafeAreaView style={s.screen}>
        <View style={s.top}>
          <LiquidButton compact hitSlop={10} style={s.round} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close player">
            <Ionicons name="chevron-down" size={24} color={t.btnText} />
          </LiquidButton>
          <Text style={s.now}>NOW PLAYING</Text>
          <LiquidButton compact hitSlop={10} style={s.speed} onPress={() => setSpeedOpen(true)} accessibilityRole="button" accessibilityLabel={`Playback speed ${rate}x`}>
            <Text style={[s.speedText, { color: rate === 1 ? t.btnText : t.accent2 }]}>{`${rate}x`}</Text>
          </LiquidButton>
        </View>

        <View style={s.discWrap}>
          <Vinyl sound={current} playing={playing} size={disc} />
        </View>

        <View style={s.info}>
          <Text style={s.title} numberOfLines={2}>{current.title}</Text>
          <Text style={s.artist} numberOfLines={1}>{artist}</Text>
          {!!current.album && <Text style={s.album} numberOfLines={1}>{current.album}</Text>}
        </View>

        <View style={s.seek}>
          <SeekBar />
        </View>

        <View style={s.controls}>
          <LiquidButton compact hitSlop={8} style={s.skip} onPress={() => { Haptics.selectionAsync().catch(() => { }); seekTo(Math.max(0, position - 10)); }} accessibilityRole="button" accessibilityLabel="Back 10 seconds">
            <Ionicons name="play-back" size={20} color={t.btnText} />
            <Text style={[s.skipText, { color: t.btnText }]}></Text>
          </LiquidButton>
          <LiquidButton tint={BRAND_TINT} style={s.play} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }); toggle(); }} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <Ionicons name={playing ? 'pause' : 'play'} size={34} color="#fff" style={{ marginLeft: playing ? 0 : 4 }} />
          </LiquidButton>
          <LiquidButton compact hitSlop={8} style={s.skip} onPress={() => { Haptics.selectionAsync().catch(() => { }); seekTo(position + 10); }} accessibilityRole="button" accessibilityLabel="Forward 10 seconds">
            <Text style={[s.skipText, { color: t.btnText }]}></Text>
            <Ionicons name="play-forward" size={20} color={t.btnText} />
          </LiquidButton>
        </View>
      </SafeAreaView>

      <SpeedDialog visible={speedOpen} rate={rate} onChange={(r) => setRate(r, false)} onCommit={(r) => setRate(r, true)} onClose={() => setSpeedOpen(false)} />
    </Backdrop>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.lg },
    top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm },
    round: { width: 44, height: 44 },
    speed: { height: 44, minWidth: 56, paddingHorizontal: 10 },
    speedText: { fontSize: 14, fontWeight: '700' },
    now: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: t.muted },
    discWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    info: { alignItems: 'center', marginBottom: space.md },
    title: { fontSize: 26, fontWeight: '800', color: t.text, textAlign: 'center', letterSpacing: -0.5 },
    artist: { fontSize: 16, fontWeight: '600', color: t.accent2, marginTop: 4, textAlign: 'center' },
    album: { fontSize: 13, color: t.muted, marginTop: 2, textAlign: 'center' },
    seek: { marginBottom: space.md },
    controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl },
    skip: { width: 62, height: 62, flexDirection: 'row', gap: 2 },
    skipText: { fontSize: 12, fontWeight: '700' },
    play: { width: 84, height: 84 },
  });
