/**
 * Lightweight animated "threat globe" — a rotating wireframe sphere rendered
 * with react-native-svg. Decorative (mirrors the design's canvas globe) while
 * the surrounding numbers/stream are driven by real data.
 *
 * The static rings/core live in one SVG; the surface dots live in a separate
 * Animated.View that rotates around the centre (simpler + cheaper than animating
 * an SVG <G> transform).
 */
import React, { useEffect, useRef, useMemo } from 'react';
import { Animated, View, Easing, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { colors } from '../theme';

export function GlobeViz({ size = 220 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 16000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // Surface dots scattered over the visible hemisphere (static positions).
  const dots = useMemo(() => {
    const out: Array<{ x: number; y: number; o: number }> = [];
    for (let i = 0; i < 90; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      const x = Math.sin(theta) * Math.cos(phi);
      const z = Math.sin(theta) * Math.sin(phi);
      const y = Math.cos(theta);
      if (z < 0) continue;
      out.push({ x: cx + x * r, y: cy - y * r, o: 0.3 + z * 0.5 });
    }
    return out;
  }, [cx, cy, r]);

  return (
    <View style={{ width: size, height: size }}>
      {/* static frame */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(43,212,238,0.12)" strokeWidth={1} />
        {[0.95, 0.6, 0.3].map((k, i) => (
          <Ellipse key={i} cx={cx} cy={cy} rx={r} ry={r * k} fill="none" stroke="rgba(43,212,238,0.08)" strokeWidth={1} />
        ))}
      </Svg>

      {/* rotating surface dots */}
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
        <Svg width={size} height={size}>
          {dots.map((d, i) => (
            <Circle key={i} cx={d.x} cy={d.y} r={1.5} fill={`rgba(86,196,224,${d.o.toFixed(2)})`} />
          ))}
        </Svg>
      </Animated.View>

      {/* core (on top, static) */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={8} fill="#13202f" stroke="rgba(246,157,57,0.5)" strokeWidth={2} />
      </Svg>
    </View>
  );
}
