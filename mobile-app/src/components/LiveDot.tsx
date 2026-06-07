/** Pulsing "live" indicator dot — RN port of the `.live` element. */
import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

export function LiveDot({ color = colors.green, size = 7 }: { color?: string; size?: number }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 2.6, duration: 1800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity]);

  const base: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
  };

  return (
    <View style={{ width: size, height: size }}>
      <View style={[base, { position: 'absolute' }]} />
      <Animated.View style={[base, { position: 'absolute', opacity, transform: [{ scale }] }]} />
    </View>
  );
}
