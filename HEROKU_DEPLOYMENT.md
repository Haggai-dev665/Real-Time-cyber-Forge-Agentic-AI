# CyberForge Heroku Deployment Guide

## 🚀 Quick Deploy to Heroku

Your Heroku app: https://cyberforge-ddd97655464f.herokuapp.com/

### Method 1: One-Click Deploy (Recommended)
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/your-username/Real-Time-cyber-Forge-Agentic-AI)

### Method 2: Manual Deployment

#### Prerequisites
- Heroku CLI installed
- Git repository
- HuggingFace ML models already deployed ✅

#### Step 1: Login to Heroku
```bash
heroku login
```

#### Step 2: Connect to your existing app
```bash
heroku git:remote -a cyberforge-ddd97655464f
```

#### Step 3: Set Environment Variables
```bash
# Required variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -base64 64)
heroku config:set ALLOWED_ORIGINS=https://cyberforge-ddd97655464f.herokuapp.com
heroku config:set HUGGINGFACE_ML_URL=https://che237-cyberforge-models.hf.space

# Optional: Add database (recommended for production)
heroku addons:create heroku-redis:mini
heroku addons:create jawsdb:kitefin  # MySQL alternative
# OR use MongoDB Atlas (set DATABASE_URL manually)

# Optional: API keys for enhanced features
heroku config:set GEMINI_API_KEY=your-gemini-key
heroku config:set OTX_API_KEY=your-otx-key
```

#### Step 4: Deploy
```bash
git add .
git commit -m "Configure for Heroku deployment"
git push heroku main
```

#### Step 5: Open your app
```bash
heroku open
```

## 🔧 Project Structure After Deployment

```
https://cyberforge-ddd97655464f.herokuapp.com/
├── /                          # Landing page (Next.js)
├── /api/                      # Backend API endpoints
├── /api/health               # Health check
├── /api/auth/login           # Authentication
├── /api/threats/scan         # Threat scanning
├── /api/cyberforge-ml/       # ML predictions (proxied to HuggingFace)
└── /ws                       # WebSocket endpoint
```

## 🖥️ Desktop App Configuration

Your desktop app will automatically connect to the production API:

- **Development**: `http://localhost:8000` 
- **Production**: `https://cyberforge-ddd97655464f.herokuapp.com`

The `api-endpoints.js` file handles this automatically based on `NODE_ENV`.

## 🔍 Verify Deployment

### 1. Check Backend Health
```bash
curl https://cyberforge-ddd97655464f.herokuapp.com/health
```

### 2. Test API Endpoints
```bash
# Test ML service proxy
curl https://cyberforge-ddd97655464f.herokuapp.com/api/cyberforge-ml/health

# Test authentication
curl -X POST https://cyberforge-ddd97655464f.herokuapp.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### 3. Check WebSocket
```bash
wscat -c wss://cyberforge-ddd97655464f.herokuapp.com/ws
```

## 🐛 Troubleshooting

### Common Issues:

1. **Build Failures**
   ```bash
   # Check logs
   heroku logs --tail
   
   # Restart app
   heroku restart
   ```

2. **Environment Variables**
   ```bash
   # List all config vars
   heroku config
   
   # Set missing variables
   heroku config:set VARIABLE_NAME=value
   ```

3. **Database Connection**
   ```bash
   # Check add-ons
   heroku addons
   
   # View Redis info
   heroku redis:info
   ```

## 📦 Desktop App Distribution

### Update Desktop App for Production:

1. **Build desktop app** with production config:
   ```bash
   cd desktop-app
   npm run build
   ```

2. **Create installers**:
   ```bash
   npm run build:all  # Builds for all platforms
   ```

3. **Distribute**: Upload to GitHub Releases or your preferred distribution method.

## 🔐 Security Notes

- JWT secrets are auto-generated
- HTTPS enforced in production
- CORS properly configured
- Rate limiting enabled
- All API keys stored as environment variables

## 📊 Monitoring

- **Heroku Dashboard**: Monitor app performance
- **Logs**: `heroku logs --tail`
- **Metrics**: Available in Heroku dashboard

Your CyberForge platform is now live at:
**https://cyberforge-ddd97655464f.herokuapp.com/** 🎉