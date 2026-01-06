# 🚀 Quick Start Commands

## Start Everything (Easiest Way)

### macOS/Linux:
```bash
./start-all-services.sh
```

### Windows:
```powershell
.\start-all-services.ps1
```

---

## Manual Start (If you prefer separate terminals)

### Terminal 1 - Backend:
```bash
cd backend
npm install  # First time only
npm start
```
✅ Backend: http://localhost:8000

### Terminal 2 - ML Services:
```bash
cd ml-services
pip install -r requirements.txt  # First time only
python main.py
```
✅ ML Services: http://localhost:8001

### Terminal 3 - Desktop App:
```bash
cd desktop-app
npm install  # First time only
npm start
```
✅ Desktop App opens automatically

---

## First Time Setup

### 1. Install Dependencies:
```bash
# Backend
cd backend && npm install

# Desktop App
cd ../desktop-app && npm install

# ML Services
cd ../ml-services && pip install -r requirements.txt
```

### 2. Configure Environment:
```bash
# Backend - Add MongoDB URI and JWT secret
cd backend
cp .env.example .env
nano .env  # or use your favorite editor

# ML Services - Add Gemini API Key (REQUIRED!)
cd ../ml-services
cp .env.example .env
nano .env  # Add GEMINI_API_KEY
```

Get Gemini API Key: https://makersuite.google.com/app/apikey

---

## Training Models

### Using Desktop App (Recommended):

1. **Launch App:** `cd desktop-app && npm start`
2. **Login/Register**
3. **Click "ML Models"** in sidebar
4. **Click "Train New Model"**
5. **Fill form:**
   - Name: "My First Model"
   - Dataset: "Phishing Detection" (fastest)
   - Keep defaults
6. **Click "Start Training"**
7. **Watch progress** in Training Jobs section

### Using API:
```bash
# Get your auth token first by logging in
TOKEN="your-jwt-token-here"

# Start training
curl -X POST http://localhost:8000/api/ml/train \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "dataset_id": "phishing_detection",
    "model_type": "auto"
  }'
```

---

## Test Everything

### Check Services Health:
```bash
# Backend
curl http://localhost:8000/health

# ML Services
curl http://localhost:8001/health
```

### View API Docs:
- Backend: http://localhost:8000/api-docs
- ML Services: http://localhost:8001/docs

---

## Troubleshooting

### MongoDB not running?
```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

### Port already in use?
```bash
# Find what's using the port (macOS/Linux)
lsof -i :8000
lsof -i :8001

# Windows
netstat -ano | findstr :8000
```

### Clear everything and restart:
```bash
# Stop all services (close terminals)
# Then:
cd backend && npm install
cd ../desktop-app && npm install
cd ../ml-services && pip install -r requirements.txt

# Restart
./start-all-services.sh
```

---

## 📚 Full Documentation

See **SETUP_GUIDE.md** for complete instructions!
