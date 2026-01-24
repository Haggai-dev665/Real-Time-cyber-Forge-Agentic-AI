# OTX Threat Visualization Guide

## Dashboard View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Dashboard                                                          [User ▾] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │                                  │  │  Security Overview              │ │
│  │         3D GLOBE                 │  │                                 │ │
│  │                                  │  │  ┌───────────────────────────┐ │ │
│  │        🌍 Earth                  │  │  │ Security Score     95%    │ │ │
│  │                                  │  │  └───────────────────────────┘ │ │
│  │   ╭─────────────╮                │  │                                 │ │
│  │   │ ⟲  Reset    │                │  │  ┌───────────────────────────┐ │ │
│  │   │ ⚙  Rotate   │                │  │  │ Active Threats    12      │ │ │
│  │   │ ➕  Traffic  │                │  │  └───────────────────────────┘ │ │
│  │   │ 🗑  Clear    │                │  │                                 │ │
│  │   ╰─────────────╯                │  │  ┌───────────────────────────┐ │ │
│  │                                  │  │  │ API Requests      1,234   │ │ │
│  │  [RED ARC] ← High Severity       │  │  └───────────────────────────┘ │ │
│  │  [AMBER ARC] ← Medium            │  │                                 │ │
│  │  [BLUE ARC] ← Low                │  │  ┌───────────────────────────┐ │ │
│  │                                  │  │  │ Findings          56      │ │ │
│  └──────────────────────────────────┘  │  └───────────────────────────┘ │ │
│                                         │                                 │ │
│  ┌─────────────────────────────────────┴─────────────────────────────────┐ │
│  │ Recent Threat Connections                                             │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │ 🔴 HIGH   North Korea → US      MacSync Stealer         Just now     │ │
│  │ 🟠 MEDIUM Russia → EU          Ransomware Campaign     2 min ago     │ │
│  │ 🔵 LOW    China → Singapore    Port Scanning           5 min ago     │ │
│  │ 🔴 HIGH   Iran → Israel        DDoS Attack             8 min ago     │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Threat Arc Visualization

### High Severity Threat (Red)
```
    Origin (N. Korea)
         ⬤
          ╲
           ╲
            ╲  ← Animated red particles
             ╲    flowing along arc
              ╲
               ⬤
           Destination (US)
```

### Medium Severity Threat (Amber)
```
    Origin (Russia)
         ⬤
          ╲
           ╲
            ╲  ← Animated amber particles
             ╲
              ╲
               ⬤
           Destination (EU)
```

### Low Severity Threat (Blue)
```
    Origin (China)
         ⬤
          ╲
           ╲
            ╲  ← Animated blue particles
             ╲
              ╲
               ⬤
           Destination (SG)
```

## Toast Notifications

### High Severity
```
┌────────────────────────────────────────┐
│ ⚠️  New Threat Detected                │
│                                        │
│ MacSync's Script-Driven Stealer        │
│ Severity: HIGH                         │
│ Adversary: North Korea (DPRK)          │
└────────────────────────────────────────┘
```

### Medium Severity
```
┌────────────────────────────────────────┐
│ ⚠️  New Threat Detected                │
│                                        │
│ Ransomware Campaign                    │
│ Severity: MEDIUM                       │
│ Malware: WannaCry, Ryuk                │
└────────────────────────────────────────┘
```

## Real-Time Updates

### Connection Flow
```
OTX API (30s polling)
    ↓
Backend Service
    ↓
WebSocket Broadcast
    ↓
Frontend Receives
    ↓
┌─────────────────────────┐
│ 1. Parse threat data    │
│ 2. Determine severity   │
│ 3. Get origin/dest      │
│ 4. Choose arc color     │
│ 5. Animate on globe     │
│ 6. Show notification    │
│ 7. Update counter       │
└─────────────────────────┘
```

## Severity Color Legend

Located in bottom-right of globe:
```
┌──────────────────────┐
│ Threat Legend        │
├──────────────────────┤
│ 🔴 High Severity     │
│ 🟠 Medium Severity   │
│ 🔵 Low Severity      │
└──────────────────────┘
```

## Threat Data Examples

### Example 1: North Korean APT
```javascript
{
  threat: "MacSync's Script-Driven Stealer",
  adversary: "North Korea (DPRK)",
  severity: "high",
  malware: ["MacSync", "SparkRAT"],
  tags: ["phishing", "macos", "cryptocurrency"],
  origin: { country: "North Korea", lat: 39.0392, lon: 125.7625 },
  destination: { country: "US", lat: 37.7749, lon: -122.4194 }
}
```

### Example 2: Ransomware Campaign
```javascript
{
  threat: "Ransomware Distribution Network",
  adversary: "Unknown",
  severity: "medium",
  malware: ["WannaCry", "Ryuk"],
  tags: ["ransomware", "encryption", "payment"],
  origin: { country: "Russia", lat: 55.7558, lon: 37.6173 },
  destination: { country: "Germany", lat: 52.5200, lon: 13.4050 }
}
```

### Example 3: Port Scanning
```javascript
{
  threat: "Automated Port Scanning",
  adversary: "Unknown",
  severity: "low",
  malware: [],
  tags: ["scanning", "reconnaissance"],
  origin: { country: "China", lat: 39.9042, lon: 116.4074 },
  destination: { country: "Singapore", lat: 1.3521, lon: 103.8198 }
}
```

## Interactive Features

### Globe Interaction
- **Click & Drag**: Rotate the globe
- **Scroll**: Zoom in/out
- **Double-Click Arc**: View threat details (coming soon)
- **Hover Arc**: Show tooltip with threat info (coming soon)

### Control Panel
```
┌─────────────────┐
│ Globe Controls  │
├─────────────────┤
│ [Reset View]    │ ← Return to default position
│ [Toggle Rotate] │ ← Enable/disable auto-spin
│ [Add Traffic]   │ ← Test with random connection
│ [Clear All]     │ ← Remove all arcs
└─────────────────┘
```

## Animation Details

### Arc Animation
- **Duration**: 2-3 seconds per particle cycle
- **Particles**: 10-20 per arc
- **Speed**: Based on threat severity (high = faster)
- **Persistence**: Arcs fade after 30 seconds

### Globe Animation
- **Rotation Speed**: 0.1 rad/s (when enabled)
- **Zoom Range**: 150-1000 units from center
- **Camera Limits**: No upside-down view

## Browser Console Output

```javascript
// WebSocket connected
✅ WebSocket connected

// Initial threats loaded
Received 20 initial threats from OTX

// New threat arrives
New OTX threat: {
  id: "pulse_12345_0",
  threat: "MacSync Stealer",
  severity: "high",
  origin: { ip: "...", lat: 39.0392, lon: 125.7625 },
  destination: { ip: "...", lat: 37.7749, lon: -122.4194 }
}

// Threat visualized
🚨 New threat: MacSync Stealer (HIGH)
```

## Performance Metrics

- **Threat Processing**: < 50ms per threat
- **Globe Rendering**: 60 FPS
- **WebSocket Latency**: < 100ms
- **Memory Usage**: +20MB for 100 arcs
- **Network Traffic**: ~50KB per threat batch

## Future Enhancements

### Planned Features
1. **Click Arc → Details Panel** - Full threat intelligence
2. **Filtering Controls** - Filter by severity, country, malware
3. **Timeline Scrubber** - Review past threats
4. **Heat Map Mode** - Density visualization
5. **3D Markers** - Persistent threat indicators on map
6. **Export Data** - Download threats as CSV/JSON
7. **Alert Rules** - Custom notifications for specific threats
8. **Geographic Clustering** - Group nearby threats

### UI Improvements
- Threat details sidebar
- Advanced filtering panel
- Historical threat timeline
- Threat statistics dashboard
- Custom alert configuration
