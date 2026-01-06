#!/bin/bash

# CyberForge AI - Model Training Examples
# This script shows how to train different models via API

echo "🧠 CyberForge AI - Model Training Examples"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if services are running
echo -e "${YELLOW}📋 Checking services...${NC}"
if ! curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend not running. Start it first:${NC}"
    echo "   cd backend && npm start"
    exit 1
fi

if ! curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  ML Services not running. Start it first:${NC}"
    echo "   cd ml-services && python main.py"
    exit 1
fi

echo -e "${GREEN}✅ All services are running!${NC}"
echo ""

# Get auth token
echo -e "${BLUE}🔐 To train models via API, you need an auth token.${NC}"
echo ""
echo "Option 1: Login via Desktop App and copy token from localStorage"
echo "Option 2: Register/Login via API:"
echo ""
echo "Register:"
echo "  curl -X POST http://localhost:8000/api/auth/register \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"user@example.com\",\"password\":\"yourpassword\",\"name\":\"Your Name\"}'"
echo ""
echo "Login:"
echo "  curl -X POST http://localhost:8000/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"user@example.com\",\"password\":\"yourpassword\"}'"
echo ""
read -p "Enter your JWT token (or press Enter to skip): " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}⚠️  No token provided. Training requests will fail without authentication.${NC}"
    echo "   Use the Desktop App for training instead!"
    echo ""
    read -p "Press Enter to see example commands anyway..."
    AUTH_HEADER=""
else
    AUTH_HEADER="-H 'Authorization: Bearer $TOKEN'"
fi

echo ""
echo "=========================================="
echo "📚 Available Datasets"
echo "=========================================="
echo ""

curl -s http://localhost:8000/api/ml/datasets | python3 -m json.tool 2>/dev/null || echo "Run this command manually to see datasets:"
echo "  curl http://localhost:8000/api/ml/datasets"

echo ""
echo ""
echo "=========================================="
echo "🚀 Training Examples"
echo "=========================================="
echo ""

echo -e "${GREEN}Example 1: Train Phishing Detector (Fast - 5 minutes)${NC}"
echo "----------------------------------------"
echo "curl -X POST http://localhost:8000/api/ml/train \\"
echo "  -H 'Content-Type: application/json' \\"
if [ -n "$TOKEN" ]; then
    echo "  -H 'Authorization: Bearer $TOKEN' \\"
fi
echo "  -d '{"
echo "    \"dataset_id\": \"phishing_detection\","
echo "    \"model_type\": \"auto\","
echo "    \"hyperparameters\": {"
echo "      \"epochs\": 10,"
echo "      \"batch_size\": 32"
echo "    }"
echo "  }'"
echo ""
read -p "Run this training? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -n "$TOKEN" ]; then
        echo "Starting training..."
        RESPONSE=$(curl -s -X POST http://localhost:8000/api/ml/train \
          -H 'Content-Type: application/json' \
          -H "Authorization: Bearer $TOKEN" \
          -d '{
            "dataset_id": "phishing_detection",
            "model_type": "auto",
            "hyperparameters": {
              "epochs": 10,
              "batch_size": 32
            }
          }')
        echo "$RESPONSE" | python3 -m json.tool
        
        # Extract job ID
        JOB_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('job_id', ''))" 2>/dev/null)
        if [ -n "$JOB_ID" ]; then
            echo ""
            echo -e "${GREEN}✅ Training started! Job ID: $JOB_ID${NC}"
            echo ""
            echo "Check status with:"
            echo "  curl http://localhost:8000/api/ml/train/$JOB_ID/status \\"
            echo "    -H 'Authorization: Bearer $TOKEN'"
        fi
    else
        echo "⚠️  No token provided. Skipping..."
    fi
fi

echo ""
echo ""
echo -e "${GREEN}Example 2: Train Malware Detector (Medium - 15 minutes)${NC}"
echo "----------------------------------------"
echo "curl -X POST http://localhost:8000/api/ml/train \\"
echo "  -H 'Content-Type: application/json' \\"
if [ -n "$TOKEN" ]; then
    echo "  -H 'Authorization: Bearer $TOKEN' \\"
fi
echo "  -d '{"
echo "    \"dataset_id\": \"malware_detection\","
echo "    \"model_type\": \"deep_learning\","
echo "    \"hyperparameters\": {"
echo "      \"epochs\": 20,"
echo "      \"batch_size\": 64,"
echo "      \"learning_rate\": 0.001"
echo "    }"
echo "  }'"
echo ""

echo ""
echo -e "${GREEN}Example 3: Train Network Intrusion Detector (Slow - 30 minutes)${NC}"
echo "----------------------------------------"
echo "curl -X POST http://localhost:8000/api/ml/train \\"
echo "  -H 'Content-Type: application/json' \\"
if [ -n "$TOKEN" ]; then
    echo "  -H 'Authorization: Bearer $TOKEN' \\"
fi
echo "  -d '{"
echo "    \"dataset_id\": \"network_intrusion\","
echo "    \"model_type\": \"gradient_boosting\","
echo "    \"hyperparameters\": {"
echo "      \"epochs\": 50,"
echo "      \"batch_size\": 128"
echo "    }"
echo "  }'"
echo ""

echo ""
echo "=========================================="
echo "📊 Check Training Status"
echo "=========================================="
echo ""

echo "Get all training jobs:"
echo "  curl http://localhost:8000/api/ml/train/history \\"
if [ -n "$TOKEN" ]; then
    echo "    -H 'Authorization: Bearer $TOKEN'"
fi
echo ""

echo "Get specific job status (replace JOB_ID):"
echo "  curl http://localhost:8000/api/ml/train/JOB_ID/status \\"
if [ -n "$TOKEN" ]; then
    echo "    -H 'Authorization: Bearer $TOKEN'"
fi
echo ""

echo ""
echo "=========================================="
echo "🎯 Use Trained Models"
echo "=========================================="
echo ""

echo "List all trained models:"
echo "  curl http://localhost:8000/api/ml/models \\"
if [ -n "$TOKEN" ]; then
    echo "    -H 'Authorization: Bearer $TOKEN'"
fi
echo ""

echo "Detect phishing:"
echo "  curl -X POST http://localhost:8000/api/ml/detect/phishing \\"
echo "    -H 'Content-Type: application/json' \\"
if [ -n "$TOKEN" ]; then
    echo "    -H 'Authorization: Bearer $TOKEN' \\"
fi
echo "    -d '{\"url\": \"http://suspicious-site.com/login\"}'"
echo ""

echo "Detect malware:"
echo "  curl -X POST http://localhost:8000/api/ml/detect/malware \\"
echo "    -H 'Content-Type: application/json' \\"
if [ -n "$TOKEN" ]; then
    echo "    -H 'Authorization: Bearer $TOKEN' \\"
fi
echo "    -d '{\"sample\": {\"file_size\": 100000, \"entropy\": 7.5}}'"
echo ""

echo ""
echo "=========================================="
echo "✨ Recommendation"
echo "=========================================="
echo ""
echo -e "${BLUE}💡 For the best experience, use the Desktop App!${NC}"
echo ""
echo "   1. Start the app: cd desktop-app && npm start"
echo "   2. Login or register"
echo "   3. Go to 'ML Models' screen"
echo "   4. Click 'Train New Model'"
echo "   5. Watch real-time progress with nice UI!"
echo ""
echo "The Desktop App provides:"
echo "   ✓ Visual training progress"
echo "   ✓ Real-time logs"
echo "   ✓ Model comparison"
echo "   ✓ Easy dataset browsing"
echo "   ✓ One-click predictions"
echo ""
