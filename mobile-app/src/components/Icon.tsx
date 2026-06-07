/**
 * Line-icon set ported verbatim from the design reference (`P` map in
 * design/cyberforge-mobile.js). Each icon is one or more SVG path strings on a
 * 24×24 grid, rendered with react-native-svg.
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

export const ICON_PATHS = {
  shield: ['M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z'],
  shieldCheck: ['M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5l-8-3Z', 'm9 12 2 2 4-4'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10 21a2 2 0 0 0 4 0'],
  bot: ['M4 7h16v12H4z', 'M12 3v4M8 12h.01M16 12h.01M9 16h6'],
  phone: ['M7 2h10v20H7z', 'M11 18h2'],
  desktop: ['M3 4h18v12H3z', 'M8 20h8M12 16v4'],
  globe: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18'],
  bolt: ['M13 2 3 14h7l-1 8 10-12h-7l1-8Z'],
  puzzle: ['M9 3a2 2 0 0 1 4 0c0 1 1 1 2 1h3v3c0 1 0 2 1 2a2 2 0 0 1 0 4c-1 0-1 1-1 2v3h-3c-1 0-2 0-2 1a2 2 0 0 1-4 0c0-1-1-1-2-1H3v-3c0-1 0-2-1-2a2 2 0 0 1 0-4c1 0 1-1 1-2V4h3c1 0 2 0 2-1Z'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18M6 6l12 12'],
  chevR: ['M9 6l6 6-6 6'],
  chevL: ['M15 6l-6 6 6 6'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
  alert: ['m12 2 10 18H2Z', 'M12 9v5M12 17h.01'],
  lock: ['M5 11h14v9H5z', 'M8 11V8a4 4 0 0 1 8 0v3'],
  eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
  activity: ['M3 12h4l2 6 4-12 2 6h6'],
  box: ['M3 7l9-4 9 4-9 4Z', 'M3 7v10l9 4 9-4V7'],
  radar: ['M12 12 19 8M12 12v9', 'M12 3a9 9 0 1 0 9 9'],
  nodes: ['M6 6h.01M18 6h.01M12 18h.01', 'M7 7 11 16M17 7 13 16M8 6h8'],
  grid: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  file: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z', 'M14 3v5h5'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 8v4l3 2'],
  cal: ['M4 5h16v16H4zM4 9h16M9 3v4M15 3v4'],
  brain: ['M12 3a4 4 0 0 0-4 4 4 4 0 0 0-1 7 4 4 0 0 0 5 4 4 4 0 0 0 5-4 4 4 0 0 0-1-7 4 4 0 0 0-4-4Z'],
  plug: ['M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v6'],
  gear: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z', 'M19.4 15a1.6 1.6 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0 1.6 1.6 0 0 0-2.7-1.1 2 2 0 1 1-2.8-2.8A1.6 1.6 0 0 0 3 13.4a2 2 0 0 1 0-4 1.6 1.6 0 0 0 1.5-2.4 2 2 0 1 1 2.8-2.8A1.6 1.6 0 0 0 10 4.6V3a2 2 0 0 1 4 0 1.6 1.6 0 0 0 2.7 1.1 2 2 0 1 1 2.8 2.8A1.6 1.6 0 0 0 19.4 9'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'm20 20-3.5-3.5'],
  spark: ['M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z'],
  flask: ['M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3'],
  eyeoff: ['M2 12s4-7 10-7c2 0 3.7.6 5.2 1.5M22 12s-4 7-10 7c-2 0-3.7-.6-5.2-1.5', 'M3 3l18 18'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color = colors.text, strokeWidth = 1.8 }: IconProps) {
  const paths = ICON_PATHS[name] ?? [];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map((d, i) => (
        <Path
          key={i}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
