# 🚀 CyberForge AI - Hugging Face Deployment Guide

This guide will walk you through deploying your ML services to Hugging Face Spaces and integrating with your backend.

## 📋 Prerequisites

1. **Hugging Face Account**: Create one at [huggingface.co](https://huggingface.co)
2. **Access Token**: Generate a write token from [Settings → Access Tokens](https://huggingface.co/settings/tokens)
3. **Git** with LFS support
4. **Python 3.9+** (for local testing)

## 🔧 Step 1: Install Hugging Face CLI

```bash
# Install the HF CLI
curl -LsSf https://hf.co/cli/install.sh | bash

# Or via pip
pip install huggingface_hub[cli]

# Login with your token
huggingface-cli login
```

## 🏗️ Step 2: Deploy to Your Space

### Option A: Using the Deployment Script (Recommended)

```bash
cd ml-services/huggingface_space

# Make script executable
chmod +x deploy.sh

# Set your token (optional - will prompt if not set)
export HF_TOKEN="your_hf_token_here"
export HF_SPACE_ID="Che237/cyberforge"

# Run deployment
./deploy.sh
```

### Option B: Manual Deployment

```bash
# 1. Clone your Space
git clone https://huggingface.co/spaces/Che237/cyberforge
cd cyberforge

# 2. Copy the files
cp ../huggingface_space/app.py .
cp ../huggingface_space/requirements.txt .
cp ../huggingface_space/trainer.py .
cp ../huggingface_space/hf_client.py .
cp ../huggingface_space/README.md .

# 3. Commit and push
git add .
git commit -m "Deploy CyberForge AI ML Platform"
git push
```

## 📊 Step 3: Prepare Your Training Datasets

Your Space needs training data. Here are the options:

### Option 1: Upload via Web UI
1. Go to your Space: `https://huggingface.co/spaces/Che237/cyberforge`
2. Use the "Train Model" tab
3. Upload your CSV/JSON/Parquet file directly

### Option 2: Use Public Datasets
The platform supports standard cybersecurity datasets:
- NSL-KDD (Network Intrusion)
- CICIDS2017 (Network Intrusion)
- PhishTank (Phishing Detection)
- VirusTotal (Malware Detection)

### Option 3: Upload to HF Datasets
```bash
# Create a dataset repository
huggingface-cli repo create cyberforge-datasets --type dataset

# Upload your data
huggingface-cli upload Che237/cyberforge-datasets ./datasets
```

## 🔗 Step 4: Backend Integration

### Add HF Client to Your Backend

Copy the client to your backend services:

```bash
cp ml-services/huggingface_space/hf_client.py backend/src/services/
```

### Install Dependencies in Backend

Add to `backend/package.json`:
```json
{
  "dependencies": {
    "@gradio/client": "^0.10.0"
  }
}
```

Or for Python backend, add to requirements:
```
gradio_client>=0.7.0
huggingface_hub>=0.19.0
```

### Example: Node.js Integration

Create `backend/src/services/hfService.js`:

```javascript
const { Client } = require("@gradio/client");

class HuggingFaceService {
    constructor() {
        this.spaceId = "Che237/cyberforge";
        this.client = null;
    }

    async connect() {
        if (!this.client) {
            this.client = await Client.connect(this.spaceId);
        }
        return this.client;
    }

    async predict(modelId, features) {
        const client = await this.connect();
        const result = await client.predict("/run_inference", {
            model_id: modelId,
            input_data: JSON.stringify([features])
        });
        return JSON.parse(result.data[0]);
    }

    async listModels() {
        const client = await this.connect();
        const result = await client.predict("/list_trained_models", {});
        return result.data[0];
    }

    async trainModel(datasetPath, config) {
        const client = await this.connect();
        const result = await client.predict("/train_model", {
            file: datasetPath,
            task_type: config.taskType,
            model_type: config.modelType,
            target_column: config.targetColumn,
            test_size: config.testSize || 0.2,
            model_name: config.modelName
        });
        return result.data;
    }
}

module.exports = new HuggingFaceService();
```

### Example: Python Integration

```python
from gradio_client import Client
import json

class HuggingFaceService:
    def __init__(self, space_id="Che237/cyberforge"):
        self.client = Client(space_id)
    
    def predict(self, model_id: str, features: dict) -> dict:
        result = self.client.predict(
            model_id,
            json.dumps([features]),
            api_name="/run_inference"
        )
        return json.loads(result)
    
    def list_models(self) -> str:
        return self.client.predict(api_name="/list_trained_models")
    
    def train_model(
        self,
        dataset_path: str,
        task_type: str,
        model_type: str,
        target_column: str,
        model_name: str,
        test_size: float = 0.2
    ) -> dict:
        result = self.client.predict(
            dataset_path,
            task_type,
            model_type,
            target_column,
            test_size,
            model_name,
            api_name="/train_model"
        )
        return result

# Usage
hf_service = HuggingFaceService()
prediction = hf_service.predict(
    "cyberforge_model_malware_detection_20240101",
    {"feature1": 0.5, "feature2": 1.2}
)
```

## 🎯 Step 5: Train Your First Model

1. **Go to your Space**: `https://huggingface.co/spaces/Che237/cyberforge`
2. **Wait for the build** (first time takes ~5 minutes)
3. **Navigate to "Train Model" tab**
4. **Upload a sample dataset** (CSV with features + label column)
5. **Configure training**:
   - Task Type: "Malware Detection"
   - Model Type: "Random Forest"
   - Target Column: "label"
   - Model Name: "malware_v1"
6. **Click "Train Model"**
7. **Copy the Model ID** from the results

## 🔄 Step 6: Continuous Training Pipeline

For automated training, you can set up a GitHub Action:

```yaml
# .github/workflows/train-models.yml
name: Train ML Models

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sundays
  workflow_dispatch:

jobs:
  train:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: pip install gradio_client huggingface_hub
      
      - name: Train models
        env:
          HF_TOKEN: ${{ secrets.HF_TOKEN }}
        run: |
          python scripts/train_models.py
```

## 📈 Step 7: Monitor Your Models

### View Training Logs
- Go to your Space → "Logs" tab
- Check training output and errors

### Model Performance
- Check the "Models" tab in your Space
- Review accuracy, F1 scores, and other metrics

### API Metrics
- Monitor response times
- Track prediction counts

## 🔒 Security Best Practices

1. **Keep your HF token secret** - Never commit it to git
2. **Use environment variables** for all tokens
3. **Enable private Spaces** for sensitive models
4. **Regular model updates** to maintain accuracy

## 🐛 Troubleshooting

### Space Not Building
- Check `requirements.txt` for version conflicts
- Look at build logs in Space settings

### Slow Predictions
- Consider upgrading to GPU Space
- Optimize model size

### Connection Errors
- Verify Space is running (green status)
- Check network/firewall settings

## 📚 Additional Resources

- [Gradio Documentation](https://www.gradio.app/docs)
- [Hugging Face Spaces](https://huggingface.co/docs/hub/spaces)
- [Hugging Face Hub Client](https://huggingface.co/docs/huggingface_hub)
- [Gradio Client Python](https://www.gradio.app/docs/python-client)
- [Gradio Client JS](https://www.gradio.app/docs/js-client)

---

## 🎉 You're Ready!

Your CyberForge AI ML platform is now deployed and ready to:
- ✅ Train models in the cloud
- ✅ Serve predictions via API
- ✅ Integrate with your backend
- ✅ Scale with Hugging Face infrastructure

**Space URL**: `https://huggingface.co/spaces/Che237/cyberforge`

Happy training! 🚀
