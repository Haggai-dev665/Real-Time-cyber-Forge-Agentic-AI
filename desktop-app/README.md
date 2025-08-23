# Cyber Forge AI - Desktop Application

The main desktop application built with Electron for real-time web browsing analysis and security monitoring.

## Features

- **Real-time Browser Monitoring**: Tracks all web pages visited
- **Security Analysis**: ML-powered threat detection and analysis
- **AI Assistant**: Interactive AI for security insights and recommendations
- **Dashboard**: Live metrics and activity monitoring
- **Threat Detection**: Real-time security threat alerts
- **Cross-platform**: Works on Windows, macOS, and Linux

## Architecture

```
src/
├── main.js              # Main Electron process
├── preload.js           # Secure bridge between main and renderer
├── browser-monitor/     # Browser monitoring functionality
│   └── monitor.js
├── ai-interface/        # AI service communication
│   └── ai-client.js
└── renderer/            # Frontend UI
    ├── index.html
    ├── styles.css
    └── app.js
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start in development mode:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Configuration

The application connects to:
- Backend service: `ws://localhost:8000` (configurable)
- AI service: `http://localhost:8001` (configurable)

## Security Features

- **Protocol Analysis**: Detects insecure HTTP connections
- **Domain Reputation**: Checks for suspicious domain patterns
- **Header Analysis**: Validates security headers
- **Risk Scoring**: Calculates security risk scores
- **Real-time Alerts**: Immediate threat notifications

## Development

The application uses:
- Electron for cross-platform desktop functionality
- WebSocket for real-time backend communication
- Modern ES6+ JavaScript
- CSS Grid and Flexbox for responsive design
- Font Awesome for icons

## Building

### Windows
```bash
npm run build -- --win
```

### macOS
```bash
npm run build -- --mac
```

### Linux
```bash
npm run build -- --linux
```

## License

MIT License - see LICENSE file for details.