# Cyber Forge AI - Mobile Application

React Native + Expo mobile companion app that connects to the desktop application for remote security monitoring and analysis.

## Features

- **Real-time Connection**: Connect to desktop app via WebSocket
- **Security Dashboard**: View analysis metrics and activity
- **Threat Monitoring**: Real-time threat alerts and notifications
- **Analysis Insights**: Browse security analysis results
- **Cross-Platform**: Works on iOS and Android

## Screenshots

The app features a modern design with:
- Gradient backgrounds with cybersecurity theme
- Real-time status indicators
- Interactive security metrics
- Threat alert notifications
- Settings for connection management

## Architecture

```
src/
├── screens/           # Main app screens
│   ├── DashboardScreen.js
│   ├── AnalysisScreen.js
│   ├── ThreatsScreen.js
│   └── SettingsScreen.js
├── navigation/        # Navigation configuration
│   └── AppNavigator.js
├── services/         # External service connections
│   └── DesktopConnection.js
├── components/       # Reusable UI components
└── theme.js         # App theme and styling
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the Expo development server:
```bash
npm start
```

3. Run on device/simulator:
```bash
npm run android  # Android
npm run ios      # iOS
npm run web      # Web
```

## Connection Setup

1. Ensure the desktop app is running
2. Find your desktop computer's IP address
3. Enter the IP:PORT in the mobile app settings
4. Connect to start receiving security data

## Configuration

The app connects to the desktop application via WebSocket:
- Default connection: `ws://192.168.1.100:8000`
- Supports custom IP addresses
- Automatic reconnection on connection loss

## Features by Screen

### Dashboard
- Connection status indicator
- Real-time security metrics
- Recent activity feed
- Quick action buttons

### Analysis
- Security analysis summary
- Recent pages analyzed
- Security pattern detection
- AI-generated insights

### Threats
- Threat overview by severity
- Active threat list with details
- Manual threat scanning
- Security recommendations

### Settings
- Desktop connection management
- Notification preferences
- Sync settings
- App information

## Building

### Android APK
```bash
npm run build:android
```

### iOS App
```bash
npm run build:ios
```

## Development

Built with:
- React Native 0.72+
- Expo SDK 49+
- React Navigation 6+
- React Native Paper (Material Design)
- Expo Vector Icons

## License

MIT License - see LICENSE file for details.