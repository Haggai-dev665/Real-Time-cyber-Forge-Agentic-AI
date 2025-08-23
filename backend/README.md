# Cyber Forge AI - Backend Services

Node.js backend services providing WebSocket communication, security analysis, and threat detection for the Cyber Forge AI platform.

## Features

- **WebSocket Server**: Real-time communication between desktop and mobile apps
- **Security Analysis**: URL and page analysis with threat detection
- **Threat Detection**: Advanced pattern matching and AI-powered analysis
- **Authentication**: JWT-based authentication and authorization
- **Rate Limiting**: API rate limiting for security
- **Database Integration**: PostgreSQL and Redis support
- **Logging**: Comprehensive logging and monitoring

## Architecture

```
src/
├── server.js              # Main server application
├── routes/                 # API route handlers
│   ├── auth.js
│   ├── analysis.js
│   └── threats.js
├── services/              # Business logic services
│   ├── websocket.js       # WebSocket management
│   ├── analysisService.js # Security analysis
│   ├── threatService.js   # Threat detection
│   ├── database.js        # Database connection
│   └── redis.js           # Redis connection
├── middleware/            # Express middleware
│   ├── auth.js
│   └── errorHandler.js
├── models/               # Data models
├── utils/                # Utility functions
└── config/               # Configuration files
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start development server:
```bash
npm run dev
```

4. Start production server:
```bash
npm start
```

## Environment Variables

```bash
PORT=8000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cyberforge
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-jwt-secret
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006

# AI Service
AI_SERVICE_URL=http://localhost:8001

# Logging
LOG_LEVEL=info
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token

### Analysis
- `GET /api/analysis/stats` - Get analysis statistics
- `POST /api/analysis/url` - Analyze specific URL
- `GET /api/analysis/history` - Get analysis history

### Threats
- `GET /api/threats` - Get detected threats
- `POST /api/threats/scan` - Initiate threat scan
- `PUT /api/threats/:id/dismiss` - Dismiss threat

## WebSocket Events

### Client to Server
- `identify` - Client identification
- `page_visit` - Page visit data
- `analysis_request` - Request analysis
- `threat_scan` - Initiate threat scan
- `request_data` - Request specific data

### Server to Client
- `connection_established` - Connection confirmation
- `analysis_result` - Analysis results
- `threat_alert` - Threat detection alert
- `analysis_data` - Analysis data response

## Security Features

- **Helmet.js**: Security headers
- **Rate Limiting**: Request rate limiting
- **CORS**: Cross-origin resource sharing
- **JWT Authentication**: Token-based auth
- **Input Validation**: Request validation
- **Error Handling**: Secure error responses

## Database Schema

### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Analysis Results
```sql
CREATE TABLE analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  url TEXT NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  security_score INTEGER,
  threats JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Threats
```sql
CREATE TABLE threats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  description TEXT,
  url TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Database Migrations
```bash
# Run migrations
npm run migrate

# Rollback migrations
npm run migrate:rollback
```

## Deployment

### Docker
```bash
# Build image
docker build -t cyber-forge-backend .

# Run container
docker run -p 8000:8000 cyber-forge-backend
```

### Production Checklist
- [ ] Set NODE_ENV=production
- [ ] Configure SSL certificates
- [ ] Set up reverse proxy (nginx)
- [ ] Configure database backups
- [ ] Set up monitoring and logging
- [ ] Configure environment variables
- [ ] Test WebSocket connections

## Monitoring

The backend provides comprehensive logging and monitoring:
- Request/response logging
- WebSocket connection tracking
- Error tracking and alerting
- Performance metrics
- Security event logging

## License

MIT License - see LICENSE file for details.