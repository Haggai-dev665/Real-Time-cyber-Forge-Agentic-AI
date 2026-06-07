/**
 * Design tokens ported 1:1 from the mobile design reference
 * (mobile-app/design/cyberforge-mobile.css :root).
 */

export const colors = {
  bg: '#070b14',
  bg2: '#0a0e18',
  surface: 'rgba(18,26,42,0.82)',
  surface2: 'rgba(24,33,52,0.7)',
  tile: '#0f1726',
  line: 'rgba(132,162,205,0.16)',
  line2: 'rgba(140,172,220,0.28)',

  text: '#e8eef8',
  dim: '#90a0b8',
  faint: '#5d6c84',

  amber: '#f5a623',
  amber2: '#ffb84d',
  amberDim: 'rgba(245,166,35,0.14)',
  cyan: '#2bd4ee',
  cyanDim: 'rgba(43,212,238,0.13)',
  green: '#43e08a',
  red: '#f4495e',
  orange: '#f69d39',
  sage: '#869b7e',
  blue: '#5aa9e6',
} as const;

/** Severity → colour, mirrors `sevC` in the design JS. */
export const severityColor: Record<string, string> = {
  critical: colors.red,
  high: colors.amber2,
  medium: colors.cyan,
  low: colors.sage,
};

export const fonts = {
  sans: 'SpaceGrotesk_400Regular',
  sansMedium: 'SpaceGrotesk_500Medium',
  sansSemiBold: 'SpaceGrotesk_600SemiBold',
  sansBold: 'SpaceGrotesk_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
} as const;

export const radius = {
  card: 18,
  tile: 16,
  pill: 99,
  sheet: 26,
} as const;

/** Tint a base colour with a translucent overlay — the RN equivalent of the
 *  design's `color-mix(in oklab, <c> X%, transparent)`. */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
