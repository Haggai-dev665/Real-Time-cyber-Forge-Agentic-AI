# Quick Start: OTX Threat Intelligence

## Start the System

### 1. Start Backend (with OTX polling)
```bash
cd backend
npm start
```

You should see:
```
✅ WebSocket server initialized
🌐 Starting OTX threat intelligence streaming...
✅ OTX threat streaming initialized
🚀 Cyber Forge Backend running on port 8000
```

### 2. Start Desktop App
```bash
cd desktop-app
npm run dev
```

### 3. View Threats on Dashboard
1. Open the app and log in
2. Navigate to **Dashboard** screen
3. Watch the globe for animated threat connections
4. **Red arcs** = High severity threats
5. **Amber arcs** = Medium severity threats
6. **Blue arcs** = Low severity threats

## Test the Integration

### Test WebSocket Connection
Open browser console (F12) in the desktop app:
```javascript
// Check WebSocket status
cyberforgeAPI.ws.readyState // Should be 1 (OPEN)

// Listen for threats
cyberforgeAPI.on('otx:threat', (threat) => {
  console.log('🚨 New threat:', threat);
});
```

### Test REST API
```bash
# Get recent threats
curl http://localhost:8000/api/otx/threats/recent?limit=10

# Search for ransomware
curl http://localhost:8000/api/otx/search?q=ransomware&limit=5

# Get OTX stats
curl http://localhost:8000/api/otx/stats

# Check specific IP
curl http://localhost:8000/api/otx/indicator/IPv4/8.8.8.8
```

## Globe Controls

**Control Panel (top-right of globe):**
- **Reset View** - Return to default camera position
- **Toggle Rotation** - Enable/disable auto-rotation
- **Add Traffic** - Manually add random connections
- **Clear Traffic** - Remove all connections

## Threat Notifications

When a new threat arrives:
- Toast notification appears (top-right)
- Animated arc draws on globe (origin → destination)
- Threat counter increments
- Connection colored by severity

## Troubleshooting

### No threats appearing?
1. Check backend console for OTX errors
2. Verify WebSocket connection: `cyberforgeAPI.ws.readyState === 1`
3. Check OTX API key in `backend/.env`
4. Test API directly: `curl http://localhost:8000/api/otx/pulses`

### Globe not rendering?
1. Check browser console for Three.js errors
2. Ensure Leaflet and Three.js CDN links loaded
3. Refresh the page
4. Check `window.cyberforgeGlobe` exists in console

### WebSocket disconnects?
1. Backend restarts will disconnect clients
2. Client auto-reconnects after 1-30 seconds
3. Check `backend/src/services/websocket.js` logs

## API Examples

### Get Subscribed Pulses
```bash
curl http://localhost:8000/api/otx/pulses?page=1&limit=20
```

### Search for Specific Threats
```bash
curl "http://localhost:8000/api/otx/search?q=phishing&limit=10"
```

### Get Indicator Details
```bash
# IP address
curl http://localhost:8000/api/otx/indicator/IPv4/1.1.1.1

# Domain
curl http://localhost:8000/api/otx/indicator/domain/example.com

# File hash
curl "http://localhost:8000/api/otx/indicator/FileHash-SHA256/abc123..."
```

### Start/Stop Polling (Admin)
```bash
# Start polling every 60 seconds
curl -X POST http://localhost:8000/api/otx/start-polling \
  -H "Content-Type: application/json" \
  -d '{"interval": 60000}'

# Stop polling
curl -X POST http://localhost:8000/api/otx/stop-polling
```

## Next Steps

1. **Add IP Geolocation**: Integrate MaxMind for accurate threat locations
2. **Threat Filtering**: Add UI controls to filter by severity/type
3. **Threat Details**: Click arcs to view full threat intelligence
4. **Historical Data**: Store threats in MongoDB for analysis
5. **Custom Alerts**: Set up notifications for specific threat types

## Resources

- [OTX API Documentation](https://otx.alienvault.com/api)
- [AlienVault OTX Dashboard](https://otx.alienvault.com/dashboard)
- [Implementation Summary](./OTX_INTEGRATION_SUMMARY.md)
