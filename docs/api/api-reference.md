# API Reference Documentation

## Overview

The Cyber Forge AI platform provides comprehensive REST APIs and WebSocket connections for real-time cybersecurity operations. This documentation covers all available endpoints, request/response formats, and integration examples.

## Base URLs

- **Production**: `https://api.cyberforge-ai.com`
- **Staging**: `https://staging-api.cyberforge-ai.com`
- **Development**: `http://localhost:8000`

## Authentication

### JWT Authentication

All API requests require authentication using JWT tokens.

```http
Authorization: Bearer <your-jwt-token>
```

### Getting an Access Token

```http
POST /auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "user": {
      "id": "uuid",
      "username": "your-username",
      "email": "user@example.com"
    }
  }
}
```

## Core APIs

### Health Check

Check the health status of the API service.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "services": {
    "database": "connected",
    "redis": "connected",
    "ml_service": "connected"
  }
}
```

### System Statistics

Get real-time system performance metrics.

```http
GET /api/v1/system/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cpu_usage": 45.2,
    "memory_usage": 67.8,
    "disk_usage": 34.1,
    "active_threats": 3,
    "processed_events": 15234,
    "uptime": 86400
  }
}
```

## Threat Detection APIs

### Scan URL

Analyze a URL for potential security threats.

```http
POST /api/v1/threats/scan-url
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://suspicious-website.com",
  "deep_scan": true,
  "include_screenshots": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scan_id": "uuid",
    "url": "https://suspicious-website.com",
    "threat_score": 8.5,
    "risk_level": "high",
    "threats_detected": [
      {
        "type": "malware",
        "confidence": 0.92,
        "description": "Potential malware distribution site"
      },
      {
        "type": "phishing",
        "confidence": 0.78,
        "description": "Suspicious login form detected"
      }
    ],
    "scan_timestamp": "2024-01-15T10:30:00Z",
    "scan_duration": 2.4
  }
}
```

### Get Threat History

Retrieve historical threat detection data.

```http
GET /api/v1/threats/history?limit=50&offset=0&severity=high
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional): Number of results to return (default: 20, max: 100)
- `offset` (optional): Number of results to skip for pagination (default: 0)
- `severity` (optional): Filter by severity level (low, medium, high, critical)
- `start_date` (optional): Filter threats after this date (ISO 8601)
- `end_date` (optional): Filter threats before this date (ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "threats": [
      {
        "id": "uuid",
        "type": "malware",
        "severity": "high",
        "source": "https://malicious-site.com",
        "detected_at": "2024-01-15T09:15:00Z",
        "status": "blocked",
        "details": {
          "threat_family": "trojan",
          "affected_files": ["document.pdf"],
          "mitigation_actions": ["quarantine", "notify_user"]
        }
      }
    ],
    "pagination": {
      "total": 245,
      "limit": 50,
      "offset": 0,
      "has_next": true
    }
  }
}
```

### File Analysis

Analyze uploaded files for malware and suspicious content.

```http
POST /api/v1/threats/analyze-file
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary-file-data>
analysis_type: "comprehensive" | "quick" | "custom"
sandbox: true | false
```

**Response:**
```json
{
  "success": true,
  "data": {
    "analysis_id": "uuid",
    "file_hash": "sha256-hash",
    "file_size": 1024768,
    "file_type": "application/pdf",
    "threat_score": 2.1,
    "risk_level": "low",
    "analysis_results": {
      "static_analysis": {
        "suspicious_strings": 0,
        "packed": false,
        "entropy": 7.2
      },
      "dynamic_analysis": {
        "executed": true,
        "network_connections": [],
        "file_modifications": [],
        "registry_changes": []
      },
      "ml_prediction": {
        "malware_probability": 0.05,
        "family_prediction": null,
        "confidence": 0.89
      }
    },
    "scan_timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## AI Assistant APIs

### Chat with AI

Interact with the AI assistant for security analysis and recommendations.

```http
POST /api/v1/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "What are the latest threats I should be aware of?",
  "conversation_id": "uuid-optional",
  "context": {
    "user_role": "security_analyst",
    "current_threats": ["malware_x", "phishing_campaign_y"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Based on recent threat intelligence, you should be aware of...",
    "conversation_id": "uuid",
    "suggestions": [
      "Review firewall rules",
      "Update threat signatures",
      "Conduct security training"
    ],
    "confidence": 0.94,
    "sources": [
      "NIST cybersecurity framework",
      "Recent CVE database",
      "Threat intelligence feeds"
    ]
  }
}
```

### Get AI Insights

Retrieve AI-generated security insights and recommendations.

```http
GET /api/v1/ai/insights?timeframe=24h&category=all
Authorization: Bearer <token>
```

**Query Parameters:**
- `timeframe`: Time period for insights (1h, 24h, 7d, 30d)
- `category`: Insight category (threats, performance, recommendations, all)

**Response:**
```json
{
  "success": true,
  "data": {
    "insights": [
      {
        "id": "uuid",
        "category": "threat_analysis",
        "title": "Unusual Network Activity Detected",
        "description": "AI detected 300% increase in outbound connections...",
        "severity": "medium",
        "confidence": 0.87,
        "recommendations": [
          "Investigate suspicious processes",
          "Review network logs",
          "Update monitoring rules"
        ],
        "created_at": "2024-01-15T10:30:00Z"
      }
    ],
    "summary": {
      "total_insights": 15,
      "high_priority": 3,
      "medium_priority": 8,
      "low_priority": 4
    }
  }
}
```

## ML Model APIs

### Model Information

Get information about available ML models.

```http
GET /api/v1/ml/models
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "malware-classifier-v2",
        "name": "Malware Classifier",
        "version": "2.1.0",
        "type": "classification",
        "accuracy": 0.967,
        "status": "active",
        "last_trained": "2024-01-10T00:00:00Z",
        "supported_formats": ["pe", "pdf", "office"],
        "description": "Advanced malware detection using deep learning"
      }
    ]
  }
}
```

### Model Prediction

Get predictions from specific ML models.

```http
POST /api/v1/ml/predict
Authorization: Bearer <token>
Content-Type: application/json

{
  "model_id": "malware-classifier-v2",
  "input_data": {
    "file_hash": "sha256-hash",
    "file_size": 1024,
    "file_type": "pe",
    "features": [0.1, 0.2, 0.3, ...]
  },
  "return_probabilities": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "prediction": {
      "class": "malware",
      "probability": 0.89,
      "confidence": 0.94
    },
    "probabilities": {
      "benign": 0.11,
      "malware": 0.89
    },
    "model_info": {
      "id": "malware-classifier-v2",
      "version": "2.1.0"
    },
    "prediction_timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Configuration APIs

### API Configuration

Manage API endpoint configurations.

```http
GET /api/v1/config/apis
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apis": [
      {
        "id": "uuid",
        "name": "VirusTotal Integration",
        "url": "https://www.virustotal.com/vtapi/v2/",
        "method": "POST",
        "status": "active",
        "last_tested": "2024-01-15T09:00:00Z",
        "response_time": 245
      }
    ]
  }
}
```

```http
POST /api/v1/config/apis
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Custom Threat Feed",
  "url": "https://api.threatfeed.com/v1/",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer api-key",
    "Content-Type": "application/json"
  },
  "auth_type": "bearer",
  "description": "Custom threat intelligence feed"
}
```

### Database Configuration

Manage database connection configurations.

```http
GET /api/v1/config/databases
Authorization: Bearer <token>
```

```http
POST /api/v1/config/databases
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Analytics Database",
  "type": "postgresql",
  "host": "analytics-db.example.com",
  "port": 5432,
  "database": "security_analytics",
  "username": "analytics_user",
  "ssl": true,
  "options": {
    "max_connections": 20,
    "timeout": 30000
  }
}
```

## WebSocket APIs

### Real-time Threat Feed

Connect to real-time threat notifications.

```javascript
const ws = new WebSocket('wss://api.cyberforge-ai.com/ws/threats');

ws.onopen = function(event) {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'your-jwt-token'
  }));
};

ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'threat_detected':
      console.log('New threat:', data.payload);
      break;
    case 'analysis_complete':
      console.log('Analysis completed:', data.payload);
      break;
  }
};
```

**Message Types:**

1. **threat_detected**
```json
{
  "type": "threat_detected",
  "payload": {
    "threat_id": "uuid",
    "severity": "high",
    "source": "network_scanner",
    "description": "Suspicious network activity detected",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

2. **analysis_complete**
```json
{
  "type": "analysis_complete",
  "payload": {
    "analysis_id": "uuid",
    "status": "completed",
    "results": {
      "threat_score": 7.2,
      "recommendations": ["isolate_host", "update_signatures"]
    }
  }
}
```

3. **system_status**
```json
{
  "type": "system_status",
  "payload": {
    "cpu_usage": 45.2,
    "memory_usage": 67.8,
    "active_connections": 142,
    "threats_blocked": 5
  }
}
```

## Error Handling

### Error Response Format

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request is invalid",
    "details": {
      "field": "url",
      "reason": "URL format is invalid"
    },
    "request_id": "uuid"
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `UNAUTHORIZED` | Invalid or missing authentication token | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `INVALID_REQUEST` | Request validation failed | 400 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMITED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable | 503 |

## Rate Limiting

API requests are rate-limited to ensure fair usage:

- **Default**: 100 requests per minute per user
- **Authenticated**: 500 requests per minute per user
- **Premium**: 2000 requests per minute per user

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1642248000
```

## SDK Examples

### JavaScript/Node.js

```javascript
const CyberForgeAPI = require('@cyberforge/api-client');

const client = new CyberForgeAPI({
  baseURL: 'https://api.cyberforge-ai.com',
  token: 'your-jwt-token'
});

// Scan a URL
const result = await client.threats.scanURL({
  url: 'https://suspicious-site.com',
  deepScan: true
});

console.log('Threat score:', result.threat_score);
```

### Python

```python
from cyberforge_api import CyberForgeClient

client = CyberForgeClient(
    base_url='https://api.cyberforge-ai.com',
    token='your-jwt-token'
)

# Analyze a file
with open('suspicious_file.exe', 'rb') as f:
    result = client.threats.analyze_file(
        file=f,
        analysis_type='comprehensive'
    )

print(f"Risk level: {result['risk_level']}")
```

### cURL Examples

```bash
# Health check
curl -X GET https://api.cyberforge-ai.com/health

# Scan URL
curl -X POST https://api.cyberforge-ai.com/api/v1/threats/scan-url \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://suspicious-site.com", "deep_scan": true}'

# Get threat history
curl -X GET "https://api.cyberforge-ai.com/api/v1/threats/history?limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

## Webhook Integration

Register webhooks to receive real-time notifications:

```http
POST /api/v1/webhooks
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/threats",
  "events": ["threat_detected", "analysis_complete"],
  "secret": "your-webhook-secret"
}
```

Webhook payload example:
```json
{
  "event": "threat_detected",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "threat_id": "uuid",
    "severity": "high",
    "source": "url_scanner"
  },
  "signature": "sha256-signature"
}
```

This API reference provides comprehensive coverage of all available endpoints and integration methods for the Cyber Forge AI platform.