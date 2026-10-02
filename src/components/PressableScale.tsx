import { ReactNode, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  // Style for the outer Pressable (flex, margins). `style` goes to the animated inner view.
  wrapStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

// Pressable with an iOS-style springy squish. Runs on the native driver.
export function PressableScale({ children, style, wrapStyle, scaleTo = 0.96, onPressIn, onPressOut, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: v === 1 ? 14 : 0 }).start();
  return (
    <Pressable
      {...rest}
      style={wrapStyle}
      onPressIn={(e) => { to(scaleTo); onPressIn?.(e); }}
      onPressOut={(e) => { to(1); onPressOut?.(e); }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
