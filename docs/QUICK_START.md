# 🚀 Real-Time Cyber Forge Agentic AI Platform

## Quick Start Guide

### Prerequisites
- Node.js 18+ 
- Python 3.9+
- PostgreSQL (optional)
- Redis (optional)

### 1. Clone and Setup
```bash
git clone https://github.com/Haggai-dev665/Real-Time-cyber-Forge-Agentic-AI.git
cd Real-Time-cyber-Forge-Agentic-AI
```

### 2. Backend Services
```bash
cd backend
npm install
npm run dev
# Server runs on http://localhost:8000
```

### 3. ML/AI Services  
```bash
cd ml-services
pip install -r requirements.txt
python main.py
# Service runs on http://localhost:8001
```

### 4. Desktop Application
```bash
cd desktop-app
npm install
npm run dev
# Electron app launches
```

### 5. Mobile Application
```bash
cd mobile-app
npm install
npx expo start
# Scan QR code with Expo Go app
```

### 6. Landing Page
```bash
cd landing-page
npm install
npm run dev
# Website runs on http://localhost:3000
```

## 🏗️ Architecture Overview

The platform consists of five main components:

### Desktop App (Electron)
- **Real-time browser monitoring** with security analysis
- **AI-powered threat detection** using machine learning
- **WebSocket server** for mobile app connectivity
- **Security dashboard** with live metrics and alerts

### Mobile App (React Native + Expo)
- **Companion app** that connects to desktop via WebSocket
- **Real-time security alerts** and analysis viewing
- **Cross-platform** support (iOS/Android)
- **Modern Material Design** interface

### Landing Page (Next.js)
- **Marketing website** with cyberpunk aesthetic
- **Download links** for all platform applications
- **Feature showcase** and platform documentation
- **Responsive design** with animations

### Backend Services (Node.js)
- **WebSocket server** for real-time communication
- **REST API** for data exchange and authentication
- **Security analysis engine** with threat detection
- **Database integration** (PostgreSQL/Redis)

### ML/AI Services (Python/FastAPI)
- **AI agent** with memory and reasoning capabilities
- **Machine learning models** for threat detection
- **Natural language processing** for security insights
- **Vector database** for knowledge storage

## 🔄 Data Flow

```
1. Desktop App monitors browsing → 
2. Sends data to Backend via WebSocket → 
3. Backend analyzes with ML Services → 
4. Results sent back to Desktop App → 
5. Mobile App receives real-time updates
```

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```bash
PORT=8000
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/cyberforge
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006
AI_SERVICE_URL=http://localhost:8001
```

#### ML Services (.env)
```bash
PORT=8001
HUGGINGFACE_API_TOKEN=your-huggingface-token-optional
DATABASE_URL=postgresql://user:pass@localhost:5432/cyberforge
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

## 🚀 Deployment

### Docker Setup
```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Production Deployment
1. **Backend**: Deploy to cloud provider (AWS, GCP, Azure)
2. **ML Services**: Use GPU-enabled instances for better performance
3. **Landing Page**: Deploy to Vercel, Netlify, or static hosting
4. **Desktop App**: Build distributables for Windows, macOS, Linux
5. **Mobile App**: Publish to App Store and Google Play

## 🔒 Security Features

- **Real-time threat detection** using AI and ML models
- **Browser monitoring** with security analysis
- **Encrypted WebSocket communication** between apps
- **JWT authentication** and rate limiting
- **Input validation** and sanitization
- **Security headers** and CORS protection

## 📱 Platform Support

### Desktop Application
- ✅ Windows 10+
- ✅ macOS 10.15+
- ✅ Linux (Ubuntu 18.04+)

### Mobile Application
- ✅ iOS 13.0+
- ✅ Android 8.0+
- ✅ Expo Go support

### Web Landing Page
- ✅ All modern browsers
- ✅ Responsive design
- ✅ PWA capabilities

## 🧪 Testing

### Run Tests
```bash
# Backend tests
cd backend && npm test

# ML Services tests  
cd ml-services && pytest

# Frontend tests
cd landing-page && npm test
```

### Manual Testing
1. Start all services
2. Launch desktop app
3. Connect mobile app
4. Test real-time data flow
5. Verify threat detection

## 📚 Documentation

- [Desktop App Documentation](desktop-app/README.md)
- [Mobile App Documentation](mobile-app/README.md)
- [Backend API Documentation](backend/README.md)
- [ML Services Documentation](ml-services/README.md)
- [Landing Page Documentation](landing-page/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔮 Future Roadmap

- [ ] Advanced AI models for threat prediction
- [ ] Integration with major antivirus engines
- [ ] Browser extension for enhanced monitoring
- [ ] Enterprise features and dashboard
- [ ] API integrations with security platforms
- [ ] Advanced analytics and reporting
- [ ] Multi-language support
- [ ] Dark web monitoring capabilities

---

**⚡ Built with cutting-edge technologies for next-generation cybersecurity protection**