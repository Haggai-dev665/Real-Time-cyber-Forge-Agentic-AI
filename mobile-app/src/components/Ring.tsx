/** Animated circular progress ring — RN port of the design `ring()` builder. */
import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface RingProps {
  value: number; // 0–100
  size: number;
  stroke: number;
  color: string;
  glow?: boolean;
  children?: React.ReactNode;
}

export function Ring({ value, size, stroke, color, glow = true, children }: RingProps) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    const target = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);
    const t = setTimeout(() => {
      Animated.timing(progress, {
        toValue: target,
        duration: 1300,
        useNativeDriver: false,
      }).start();
    }, 60);
    return () => clearTimeout(t);
  }, [value, circumference, progress]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(126,148,184,0.14)"
          strokeWidth={stroke}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </View>
    </View>
  );
}
