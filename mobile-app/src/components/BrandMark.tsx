/** CyberForge logo mark — ported from the design `mark()` builder. */
import React from 'react';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { colors } from '../theme';

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" fill="none">
      <Rect x={2} y={2} width={56} height={56} rx={13} fill="#101826" stroke={colors.line2} />
      <Path d="M16 44 L30 15 L44 44 Z" fill={colors.orange} />
      <Path d="M23.5 44 L30 30 L36.5 44 Z" fill="#101826" />
      <Circle cx={30} cy={44} r={3} fill={colors.sage} />
    </Svg>
  );
}
