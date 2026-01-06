# CyberForge AI - Setup and Training Guide

## 🚀 Quick Start

This guide will help you set up and run all services, then train your ML models.

---

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Python** (3.8 or higher)
- **MongoDB** (running on localhost:27017)
- **Google Gemini API Key** (get from https://makersuite.google.com/app/apikey)

---

## 🔧 Initial Setup

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# Desktop App
cd ../desktop-app
npm install

# ML Services
cd ../ml-services
pip install -r requirements.txt
# or
python -m pip install -r requirements.txt
```

### 2. Configure Environment Variables

#### Backend (.env)
```bash
cd backend
cp .env.example .env
# Edit .env and add your configurations:
# - MONGODB_URI
# - JWT_SECRET
# - GOOGLE_CLIENT_ID (optional, for OAuth)
# - GOOGLE_CLIENT_SECRET (optional, for OAuth)
```

#### ML Services (.env)
```bash
cd ml-services
cp .env.example .env
# Edit .env and add:
# - GEMINI_API_KEY (REQUIRED for AI features)
```

#### Desktop App (.env)
```bash
cd desktop-app
cp .env.example .env
# Edit .env if needed (defaults should work for local development)
```

---

## 🏃 Starting All Services

### Option 1: Manual Start (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Or for development with auto-reload:
npm run dev
```
Backend will run on **http://localhost:8000**

**Terminal 2 - ML Services:**
```bash
cd ml-services
python main.py
# Or with uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```
ML Services will run on **http://localhost:8001**

**Terminal 3 - Desktop App:**
```bash
cd desktop-app
npm start
```
Desktop app will launch as an Electron application

### Option 2: Using Start Scripts

I've created convenient start scripts for you:

**macOS/Linux:**
```bash
# Make scripts executable
chmod +x start-all-services.sh

# Start all services
./start-all-services.sh
```

**Windows:**
```powershell
.\start-all-services.ps1
```

---

## 🧠 Training ML Models

### Method 1: Using the Desktop App (Easiest)

1. **Launch the Desktop App**
   ```bash
   cd desktop-app
   npm start
   ```

2. **Login/Register**
   - The app will show the authentication page first
   - Register a new account or login
   - Optional: Use Google OAuth

3. **Navigate to ML Models Screen**
   - Click on "ML Models" in the sidebar
   - Or use the navigation menu

4. **View Available Datasets**
   - Click on "Datasets" in the sidebar
   - Browse available datasets:
     - Malware Detection (50K samples)
     - Network Intrusion (125K samples)
     - Phishing Detection (11K samples)
     - And more...

5. **Train a New Model**
   - Go back to "ML Models" screen
   - Click **"Train New Model"** button
   - Fill in the training form:
     - **Model Name:** e.g., "My Malware Detector"
     - **Model Type:** Classification
     - **Dataset:** Choose from dropdown
     - **Configuration:**
       - Epochs: 10-50 (default: 10)
       - Batch Size: 32 (default)
       - Learning Rate: 0.001 (default)
   - Click **"Start Training"**

6. **Monitor Training Progress**
   - Training jobs appear in the "Training Jobs" section
   - Watch real-time progress bar
   - View logs and status updates
   - Training typically takes 10-20 minutes depending on dataset size

7. **Use Trained Models**
   - Once training completes, the model appears in "Available Models"
   - View model metrics (accuracy, precision, recall, F1-score)
   - Deploy model for predictions
   - Export model if needed

### Method 2: Using the API (Advanced)

**1. Get Available Datasets:**
```bash
curl http://localhost:8000/api/ml/datasets
```

**2. Start Training:**
```bash
curl -X POST http://localhost:8000/api/ml/train \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "dataset_id": "malware_detection",
    "model_type": "auto",
    "hyperparameters": {
      "epochs": 10,
      "batch_size": 32,
      "learning_rate": 0.001
    }
  }'
```

**3. Check Training Status:**
```bash
curl http://localhost:8000/api/ml/train/JOB_ID/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**4. Get Trained Models:**
```bash
curl http://localhost:8000/api/ml/models \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Method 3: Direct Python Training

```bash
cd ml-services

# Run the ML trainer directly
python -c "
from app.services.ml_trainer import CyberSecurityMLTrainer
from app.services.dataset_manager import DatasetManager

# Initialize services
dataset_manager = DatasetManager()
trainer = CyberSecurityMLTrainer()

# Train models
import asyncio
asyncio.run(trainer.train_comprehensive_models(dataset_manager))
"
```

---

## 🔍 Testing the System

### 1. Test Backend Health
```bash
curl http://localhost:8000/health
```

### 2. Test ML Services
```bash
curl http://localhost:8001/health
```

### 3. Test Threat Detection
```bash
# Detect Phishing
curl -X POST http://localhost:8000/api/ml/detect/phishing \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"url": "http://suspicious-site.com/login"}'

# Detect Malware
curl -X POST http://localhost:8000/api/ml/detect/malware \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"sample": {"file_size": 100000, "entropy": 7.5}}'
```

### 4. Test AI Assistant
```bash
curl -X POST http://localhost:8000/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "What are the latest cybersecurity threats?"}'
```

---

## 📊 Available Datasets

The system includes these pre-configured datasets:

| Dataset | Type | Samples | Features | Use Case |
|---------|------|---------|----------|----------|
| **Malware Detection** | Binary | 50,000 | 78 | Detect malicious executables |
| **Network Intrusion** | Multi-class | 125,973 | 41 | Detect network attacks |
| **Phishing Detection** | Binary | 11,055 | 30 | Identify phishing websites |
| **Spam Detection** | Binary | 5,572 | 57 | Filter spam emails |
| **Botnet Detection** | Binary | 72,000 | 14 | Detect botnet traffic |
| **Vulnerability Assessment** | Multi-class | 20,000 | 25 | Predict CVE severity |
| **DNS Tunneling** | Binary | 30,000 | 18 | Detect DNS exfiltration |
| **Cryptomining** | Binary | 15,000 | 22 | Detect cryptojacking |
| **Web Attack Detection** | Multi-class | 45,000 | 35 | Detect SQL injection, XSS |
| **Threat Intelligence** | Multi-class | 100,000 | 20 | IOC classification |
| **Anomaly Detection** | Binary | 80,000 | 28 | Detect network anomalies |

---

## 🎯 Model Training Tips

### Best Practices

1. **Start Small:** Begin with smaller datasets (spam, phishing) for faster training
2. **Adjust Hyperparameters:** 
   - Higher epochs = better accuracy but longer training
   - Larger batch size = faster but needs more memory
   - Lower learning rate = more stable but slower convergence

3. **Monitor Progress:** Watch the training progress and logs
4. **Compare Models:** Train multiple models on same dataset with different parameters
5. **Evaluate Performance:** Check accuracy, precision, recall, and F1-score

### Recommended Training Sequence

1. **First:** Phishing Detection (11K samples, ~5 minutes)
2. **Second:** Spam Detection (5K samples, ~3 minutes)
3. **Third:** Malware Detection (50K samples, ~15 minutes)
4. **Fourth:** Network Intrusion (125K samples, ~30 minutes)

---

## 🐛 Troubleshooting

### Backend won't start
- Check MongoDB is running: `mongod --version`
- Verify port 8000 is available
- Check `.env` file exists and is configured

### ML Services won't start
- Install Python dependencies: `pip install -r requirements.txt`
- Add GEMINI_API_KEY to `.env`
- Verify port 8001 is available

### Desktop App won't start
- Run `npm install` in desktop-app folder
- Check backend and ML services are running
- Clear app cache: Delete `node_modules` and reinstall

### Training fails
- Check ML services are running (http://localhost:8001/health)
- Verify GEMINI_API_KEY is set
- Check dataset is available
- Review logs in ml-services/logs/

### Authentication issues
- Clear browser/app cache
- Check JWT_SECRET is set in backend `.env`
- Verify MongoDB is running
- Check token expiration

---

## 📚 API Documentation

Once services are running:

- **Backend API Docs:** http://localhost:8000/api-docs
- **ML Services API Docs:** http://localhost:8001/docs
- **Alternative Docs:** http://localhost:8001/redoc

---

## 🔐 Security Notes

- Never commit `.env` files to version control
- Change default JWT_SECRET in production
- Use HTTPS in production
- Rotate API keys regularly
- Keep dependencies updated

---

## 📞 Need Help?

- Check logs in respective service directories
- Review error messages in terminal
- Check API documentation
- Verify all services are running

---

## 🎉 You're Ready!

Your CyberForge AI platform is now set up. Happy training! 🚀
