import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENT, useTheme } from '../theme';
import { Sound } from '../types';
import { coverOf } from './SoundArt';

const GROOVES = [0.97, 0.9, 0.83, 0.76, 0.69, 0.62, 0.55];
const SECONDS_PER_TURN = 9;

// A vinyl record: black disc with grooves and a light reflection, the cover art (or emoji) as the
// center label. It spins while `playing` and keeps its angle when paused.
export function Vinyl({ sound, playing, size }: { sound: Sound; playing: boolean; size: number }) {
  const t = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  const angle = useRef(0); // last known angle in turns, so pausing/resuming doesn't jump

  useEffect(() => {
    if (!playing) {
      spin.stopAnimation((v) => { angle.current = v; });
      return;
    }
    const TURNS = 2000;
    const anim = Animated.timing(spin, {
      toValue: angle.current + TURNS,
      duration: TURNS * SECONDS_PER_TURN * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [playing]);

  const label = size * 0.4;
  const cover = coverOf(sound);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        boxShadow: playing
          ? '0 18 40 rgba(0,0,0,0.55), 0 0 60 rgba(124,92,255,0.45)'
          : '0 14 32 rgba(0,0,0,0.5), 0 0 30 rgba(124,92,255,0.18)',
      }}
    >
      <Animated.View style={[s.disc, { width: size, height: size, borderRadius: size / 2, transform: [{ rotate }] }]}>
        {GROOVES.map((g) => (
          <View
            key={g}
            style={{
              position: 'absolute',
              width: size * g,
              height: size * g,
              borderRadius: (size * g) / 2,
              borderWidth: StyleSheet.hairlineWidth * 2,
              borderColor: 'rgba(255,255,255,0.07)',
            }}
          />
        ))}
        {/* label / cover */}
        <View style={{ width: label, height: label, borderRadius: label / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          {cover ? (
            <Image source={{ uri: cover }} style={{ width: label, height: label }} resizeMode="cover" />
          ) : (
            <>
              <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Text style={{ fontSize: label * 0.42 }}>{sound.emoji ?? '🔊'}</Text>
              {/* notch so the rotation is visible on the plain label */}
              <View style={{ position: 'absolute', top: label * 0.1, width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.85)' }} />
            </>
          )}
        </View>
        {/* spindle hole */}
        <View style={{ position: 'absolute', width: size * 0.045, height: size * 0.045, borderRadius: size, backgroundColor: t.bg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }} />
      </Animated.View>

      {/* light reflection: stays still while the disc turns, which is what makes it read as glossy */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.08)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0.05 }}
        end={{ x: 0.9, y: 0.95 }}
        style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2 }}
      />
      <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)' }} />
    </View>
  );
}

const s = StyleSheet.create({
  disc: { backgroundColor: '#0A0A10', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
