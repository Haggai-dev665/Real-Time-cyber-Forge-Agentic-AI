# OTX Threat Intelligence Integration - Implementation Summary

## Overview
Successfully integrated AlienVault Open Threat Exchange (OTX) API into the Cyber Forge platform, enabling real-time cyber threat visualization on the dashboard's 3D globe.

## Features Implemented

### 1. Backend OTX Service (`backend/src/services/otx.js`)
- **Threat Polling**: Automatically fetches new threat pulses every 30 seconds
- **Event Streaming**: Emits real-time threat events via EventEmitter
- **Data Transformation**: Converts OTX pulse data to visualizable threat events
- **Severity Calculation**: Automatically categorizes threats as high/medium/low
- **Geographic Extraction**: Parses IP-based indicators for globe visualization

**Key Methods:**
- `getSubscribedPulses()` - Fetch threat pulses from OTX
- `searchPulses()` - Search for specific threats
- `getIndicatorDetails()` - Get details for IPs, domains, hashes
- `startPolling()` - Begin real-time threat monitoring
- `transformPulseToThreatEvents()` - Convert OTX data to visualization format

### 2. WebSocket Integration (`backend/src/services/websocket.js`)
- **Real-Time Broadcasting**: Streams threats to all connected clients
- **Initial Data Load**: Sends last 20 threats on client connection
- **Auto-Initialization**: Starts OTX polling when WebSocket server starts

**New Message Types:**
- `otx_threat` - Real-time threat event
- `initial_threats` - Batch of recent threats on connection
- `request_initial_threats` - Client requests initial data

### 3. REST API Endpoints (`backend/src/routes/otx.js`)
- `GET /api/otx/pulses` - Get paginated threat pulses
- `GET /api/otx/search?q=malware` - Search for specific threats
- `GET /api/otx/indicator/:type/:indicator` - Get indicator details
- `GET /api/otx/threats/recent` - Get recent threats for dashboard
- `POST /api/otx/start-polling` - Start threat polling (admin)
- `POST /api/otx/stop-polling` - Stop threat polling (admin)
- `GET /api/otx/stats` - Get OTX service statistics

### 4. Frontend Visualization (`desktop-app/src/renderer/caido-app.js`)
- **Globe Integration**: Visualizes threats as arcs on 3D globe
- **Severity Color Coding**:
  - High: Red (#ef4444)
  - Medium: Amber (#f59e0b)
  - Low: Blue (#3b82f6)
- **Real-Time Updates**: Animates new threats as they arrive
- **Toast Notifications**: Shows threat alerts with severity
- **Auto Counter**: Updates threat count on dashboard

**New Functions:**
- `setupOTXThreatListeners()` - Register WebSocket event handlers
- `visualizeThreatsOnGlobe()` - Display multiple threats
- `visualizeThreatOnGlobe()` - Display single threat with animation

### 5. API Client Updates (`desktop-app/src/renderer/api-client.js`)
- **Auto Request**: Requests initial threats on WebSocket connection
- **Event Handlers**: New events `otx:threat` and `otx:initial_threats`
- **Message Routing**: Routes OTX messages to registered handlers

## Configuration

### Environment Variables
```bash
# backend/.env
OTX_API_KEY=e80a674c5bab3cd2f9acaebf9eedabe7c82735443b6c986a2b9e3791488c928d
```

### API Key Details
- **User**: chehaggai
- **Subscription**: Active (1 day old)
- **Status**: Verified working (200 OK responses)

## Data Flow

```
OTX API → Backend Service → WebSocket → Frontend Client → Globe Visualization
   ↓           ↓                ↓              ↓                    ↓
Pulses    Transform to     Broadcast       Parse           Draw arcs
30s poll  threat events    to clients     threats        with colors
```

## Example Threat Event Structure
```javascript
{
  id: "pulse_id_0",
  timestamp: 1737683847000,
  origin: {
    ip: "192.168.1.1",
    country: "Unknown",
    lat: 45.2345,
    lon: -122.5678
  },
  destination: {
    ip: "Target Network",
    country: "US",
    lat: 37.7749,
    lon: -122.4194
  },
  threat: "MacSync's Script-Driven Stealer",
  adversary: "North Korea (DPRK)",
  malware: ["MacSync", "SparkRAT"],
  severity: "high",
  tags: ["phishing", "macos", "cryptocurrency"],
  description: "Sophisticated macOS infostealer..."
}
```

## Testing

### Manual API Tests
```bash
# Get subscribed pulses
curl -sS "https://otx.alienvault.com/api/v1/pulses/subscribed?page=1&limit=10" \
  -H "X-OTX-API-KEY: e80a674c5bab3cd2f9acaebf9eedabe7c82735443b6c986a2b9e3791488c928d"

# Search for malware
curl -sS "https://otx.alienvault.com/api/v1/search/pulses?q=malware&limit=5" \
  -H "X-OTX-API-KEY: e80a674c5bab3cd2f9acaebf9eedabe7c82735443b6c986a2b9e3791488c928d"

# Check IP reputation
curl -sS "https://otx.alienvault.com/api/v1/indicators/IPv4/8.8.8.8/general" \
  -H "X-OTX-API-KEY: e80a674c5bab3cd2f9acaebf9eedabe7c82735443b6c986a2b9e3791488c928d"
```

### Backend Tests
```bash
# Start backend
cd backend && npm start

# Test OTX routes
curl http://localhost:8000/api/otx/pulses
curl http://localhost:8000/api/otx/search?q=ransomware
curl http://localhost:8000/api/otx/threats/recent
curl http://localhost:8000/api/otx/stats
```

### WebSocket Test
```javascript
// In browser console
cyberforgeAPI.on('otx:threat', (threat) => {
  console.log('New threat:', threat);
});
```

## Usage

### Viewing Threats on Dashboard
1. Start backend: `cd backend && npm start`
2. Start desktop app: `cd desktop-app && npm run dev`
3. Navigate to Dashboard screen
4. Watch globe for real-time threat connections
5. Red arcs = High severity
6. Amber arcs = Medium severity
7. Blue arcs = Low severity

### Programmatic Access
```javascript
// Get recent threats
const response = await fetch('http://localhost:8000/api/otx/threats/recent?limit=20');
const data = await response.json();
console.log(data.data); // Array of threat events

// Search for specific threats
const search = await fetch('http://localhost:8000/api/otx/search?q=phishing&limit=10');
const results = await search.json();
```

## Limitations & Future Improvements

### Current Limitations
- **Geo Data**: Currently using placeholder coordinates; need IP geolocation service
- **Polling Only**: No webhook support (OTX doesn't provide webhooks)
- **Rate Limits**: OTX API has rate limits (not documented in their public docs)
- **Simplified Severity**: Basic severity calculation based on metadata

### Recommended Enhancements
1. **IP Geolocation**: Integrate MaxMind or ipinfo.io for accurate coordinates
2. **Threat Filtering**: Allow users to filter by severity, malware family, adversary
3. **Historical Data**: Store threats in MongoDB for historical analysis
4. **Threat Details Panel**: Click arcs to show full threat intelligence
5. **Export Functionality**: Export threats as CSV/JSON
6. **Alerting Rules**: Create custom alerts for specific threat types
7. **Integration with SIEM**: Forward threats to Splunk, ELK, etc.

## Security Considerations
- ✅ API key stored in .env (not committed)
- ✅ Backend validates indicator types
- ✅ Rate limiting applied to all API routes
- ✅ WebSocket requires authentication
- ⚠️ OTX data should be treated as indicators, not definitive threats
- ⚠️ Implement IP allow-listing for production WebSocket

## Dependencies Added
```json
{
  "axios": "^1.6.0",  // HTTP client for OTX API
  "events": "built-in" // EventEmitter for streaming
}
```

## Files Modified/Created

### Created
- `backend/src/services/otx.js` (332 lines)
- `backend/src/routes/otx.js` (185 lines)

### Modified
- `backend/src/services/websocket.js` (+60 lines)
- `backend/src/server.js` (+2 lines)
- `backend/.env` (+1 line)
- `desktop-app/src/renderer/api-client.js` (+10 lines)
- `desktop-app/src/renderer/caido-app.js` (+85 lines)

## Result
The dashboard now displays **real-time global cyber threats** from AlienVault OTX, visualized as animated arcs on a 3D globe with color-coded severity levels. Threats stream automatically via WebSocket every 30 seconds, providing continuous threat intelligence awareness.
