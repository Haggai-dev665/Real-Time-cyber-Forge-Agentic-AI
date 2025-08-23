import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#00d4ff',
    accent: '#0099cc',
    background: '#1e3c72',
    surface: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    placeholder: 'rgba(255, 255, 255, 0.6)',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    notification: '#ff4444',
    onSurface: '#ffffff',
    disabled: 'rgba(255, 255, 255, 0.4)',
  },
  roundness: 12,
  fonts: {
    ...DefaultTheme.fonts,
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700',
    },
  },
};

export const gradientColors = ['#1e3c72', '#2a5298'];

export const statusColors = {
  connected: '#00ff88',
  disconnected: '#ff4444',
  warning: '#ffaa00',
};

export const riskColors = {
  low: '#00ff88',
  medium: '#ffaa00',
  high: '#ff4444',
};