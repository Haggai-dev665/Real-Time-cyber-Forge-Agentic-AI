# 🛡️ Real-Time Cyber Forge Agentic AI

<div align="center">
  <img src="docs/images/cyber-forge-banner.png" alt="Cyber Forge AI Banner" width="800"/>
  
  [![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)](https://github.com/Haggai-dev665/Real-Time-cyber-Forge-Agentic-AI)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  [![AI Powered](https://img.shields.io/badge/AI-Powered-red.svg)](https://github.com/Haggai-dev665/Real-Time-cyber-Forge-Agentic-AI)
  [![Electron](https://img.shields.io/badge/Electron-25.0.0-9feaf9.svg)](https://electronjs.org/)
  [![React](https://img.shields.io/badge/React-18.0.0-61dafb.svg)](https://reactjs.org/)
  [![TensorFlow](https://img.shields.io/badge/TensorFlow-2.13.0-ff6f00.svg)](https://tensorflow.org/)
</div>

## 🚀 Revolutionary Cybersecurity Platform with Advanced AI Intelligence

**Real-Time Cyber Forge Agentic AI** is a cutting-edge, comprehensive cybersecurity platform that harnesses the power of artificial intelligence and machine learning to provide unparalleled threat detection, real-time security monitoring, and intelligent incident response capabilities. Built for the modern digital landscape, this platform combines advanced AI agents with sophisticated analytics to create an adaptive security ecosystem.

---

## 🎯 **NEW: TODO 1 - Core Agent & Control Plane (COMPLETE)**

✅ **Cyberforge is now a real security system, not a demo!**

TODO 1 establishes the foundational control plane and autonomous security agent:

- **Appwrite Control Plane** - Single source of truth for identity, authentication, and agent control
- **Autonomous Security Agents** - Continuously running agents with heartbeat and task polling
- **Complete Traceability** - Every alert maps to user, device, agent, and evidence
- **ML + Gemini Integration** - Threat classification and AI-generated explanations
- **Datadog Observability** - Comprehensive metrics tracking

### 📚 TODO 1 Documentation

| Document | Description |
|----------|-------------|
| [**Quick Start Guide**](docs/TODO_1_QUICKSTART.md) | Get started in 5 minutes |
| [**Implementation Details**](docs/TODO_1_IMPLEMENTATION.md) | Technical documentation |
| [**Appwrite Setup**](docs/APPWRITE_SETUP.md) | Control plane configuration |
| [**Summary**](docs/TODO_1_SUMMARY.md) | Executive overview |

### 🚀 Quick Start (TODO 1)

```bash
# 1. Install dependencies
cd backend && npm install

# 2. Configure Appwrite (see docs/APPWRITE_SETUP.md)
cp .env.example .env
# Add your Appwrite credentials

# 3. Start the backend
npm run dev

# 4. Start an agent
curl -X POST http://localhost:8000/api/agent/start \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "agentName": "scanner1"}'
```

[➡️ Full Quick Start Guide](docs/TODO_1_QUICKSTART.md)

---

## ⚡ Quick Start

### 🎯 One-Command Setup

**macOS/Linux:**
```bash
./start-all-services.sh
```

**Windows:**
```powershell
.\start-all-services.ps1
```

### 📖 First Time Setup

1. **Install Dependencies:**
   ```bash
   # Backend
   cd backend && npm install
   
   # Desktop App
   cd ../desktop-app && npm install
   
   # ML Services
   cd ../ml-services && pip install -r requirements.txt
   ```

2. **Configure Environment:**
   ```bash
   # Backend - Add MongoDB URI
   cp backend/.env.example backend/.env
   
   # ML Services - Add Gemini API Key (REQUIRED!)
   cp ml-services/.env.example ml-services/.env
   # Edit ml-services/.env and add GEMINI_API_KEY
   ```
   
   Get Gemini API Key: https://makersuite.google.com/app/apikey

3. **Start Services:**
   ```bash
   ./start-all-services.sh
   ```

4. **Train Your First Model:**
   - Open the Desktop App
   - Login/Register
   - Go to "ML Models" → "Train New Model"
   - Select "Phishing Detection" dataset
   - Click "Start Training"
   - Watch progress in real-time! 🎉

📚 **Full Documentation:** See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions

### 🌟 Groundbreaking Features

#### 🔍 **Intelligent Threat Detection**
- **Real-Time Monitoring**: Continuous analysis of web browsing patterns, network traffic, and system behavior
- **AI-Powered Analysis**: Advanced machine learning models trained on millions of threat samples
- **Behavioral Analytics**: Sophisticated algorithms that learn normal patterns and detect anomalies
- **Zero-Day Protection**: Proactive threat identification using heuristic analysis and AI inference

#### 🤖 **Agentic AI Assistant**
- **Memory-Enhanced AI**: Persistent learning capabilities that adapt to your security environment
- **Contextual Understanding**: Deep comprehension of security contexts and threat landscapes
- **Intelligent Recommendations**: Automated suggestions for security improvements and threat mitigation
- **Natural Language Interface**: Conversational AI for intuitive security management

#### 📊 **Advanced Analytics Dashboard**
- **Real-Time Visualizations**: Beautiful, interactive charts and graphs with live data updates
- **Threat Intelligence**: Comprehensive threat landscape analysis with geographic mapping
- **Performance Metrics**: System health monitoring with predictive analytics
- **Custom Reports**: Automated report generation with executive summaries

#### 🔧 **Comprehensive Backend Integration**
- **API Management Console**: Centralized control for all external API integrations
- **Database Connectivity**: Support for PostgreSQL, MongoDB, Redis, MySQL, and Elasticsearch
- **WebSocket Communications**: Real-time bidirectional data streaming
- **Service Health Monitoring**: Automatic health checks and failover mechanisms

#### 🎨 **Stunning User Experience**
- **Modern Black & White Theme**: Elegant, professional interface design
- **Lottie Animations**: Smooth, vector-based animations for enhanced user experience
- **Responsive Design**: Optimized for various screen sizes and resolutions
- **Accessibility Compliant**: WCAG 2.1 AA standards for inclusive design

### 🏗️ **Advanced Architecture**

#### **Multi-Layered Security Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Desktop App   │    │   Mobile App    │    │   Web Portal    │
│  (Electron)     │    │ (React Native)  │    │   (Next.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────────┐
         │                API Gateway                           │
         │         (Rate Limiting, Authentication)             │
         └─────────────────────────────────────────────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                            │                            │
┌───▼────┐    ┌──────▼──────┐    │    ┌──────▼──────┐    ┌───▼────┐
│Threat  │    │     AI      │    │    │   Backend   │    │  Data  │
│Analysis│    │   Service   │    │    │   Services  │    │ Layer  │
│Service │    │(TensorFlow) │    │    │(Node.js/    │    │(Multi- │
│        │    │(LangChain)  │    │    │ Express)    │    │  DB)   │
└────────┘    └─────────────┘    │    └─────────────┘    └────────┘
                                 │
         ┌─────────────────────────────────────────────────────┐
         │           External Integrations                     │
         │    (VirusTotal, Shodan, Threat Intelligence)       │
         └─────────────────────────────────────────────────────┘
```

#### **AI/ML Pipeline**
- **Data Ingestion**: Multi-source data collection and preprocessing
- **Feature Engineering**: Advanced feature extraction and normalization
- **Model Training**: Continuous learning with automated model updates
- **Inference Engine**: Real-time threat scoring and classification
- **Feedback Loop**: Human-in-the-loop learning for model improvement

### 🎯 **Target Applications**

#### **Enterprise Security Operations Centers (SOCs)**
- **Centralized Monitoring**: Unified dashboard for multi-environment security oversight
- **Incident Response**: Automated threat response with customizable playbooks
- **Compliance Reporting**: Automated generation of compliance reports for various frameworks
- **Team Collaboration**: Shared workspaces and communication tools

#### **Small to Medium Businesses (SMBs)**
- **Affordable Protection**: Enterprise-grade security at SMB-friendly pricing
- **Easy Deployment**: One-click installation and configuration
- **Managed Services**: Optional managed security services
- **Training Resources**: Comprehensive security awareness training

#### **Individual Security Professionals**
- **Personal Protection**: Advanced security for personal devices and networks
- **Research Platform**: Tools for security research and analysis
- **Learning Environment**: Educational resources and practice scenarios
- **Community Features**: Connect with other security professionals

## 🚀 Features

- **Desktop Application (Electron)**: Main application that monitors and analyzes all web pages visited
- **Mobile Application (React Native + Expo)**: Companion app that connects to desktop for mobile analytics
- **AI-Powered Analysis**: Advanced machine learning models for threat detection and pattern recognition
- **Real-time Monitoring**: Live analysis of browsing behavior and security risks
- **Agentic AI**: Intelligent agent with memory capabilities for adaptive security learning
- **Cross-Platform Sync**: Seamless data synchronization between desktop and mobile

## 📱 Applications

### Desktop App
- Real-time web page analysis
- Browser monitoring and data collection
- ML-based threat detection
- Security analytics dashboard
- AI agent interface

### Mobile App
- View analysis from desktop app
- Receive security alerts
- Quick security overview
- Remote monitoring capabilities

### Landing Page
- Download links for applications
- Platform documentation
- Feature showcase
- User guides

## 🛠 Technology Stack

- **Desktop**: Electron + React + TypeScript
- **Mobile**: React Native + Expo
- **Backend**: Node.js + Express + WebSocket
- **ML/AI**: Python + FastAPI + TensorFlow + LangChain
- **Database**: PostgreSQL + Redis
- **Frontend**: Next.js (Landing Page)

## 📦 Project Structure

```
├── desktop-app/          # Electron application
├── mobile-app/           # React Native + Expo application  
├── landing-page/         # Website for downloads and info
├── backend/              # Node.js backend services
├── ml-services/          # Python ML and AI services
├── shared/               # Shared utilities and types
└── docs/                 # Documentation
```

## 🚀 Quick Start

1. Clone the repository
2. Follow setup instructions in each application folder
3. Start the backend services
4. Launch the desktop application
5. Connect mobile app to desktop

## 📋 Requirements

- Node.js 18+
- Python 3.9+
- PostgreSQL
- Redis

## 🔒 Security

This platform prioritizes user privacy and data security. All analysis is performed locally with encrypted data transmission.
