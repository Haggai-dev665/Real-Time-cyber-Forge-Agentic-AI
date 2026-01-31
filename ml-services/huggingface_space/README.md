---
title: CyberForge AI
emoji: 🔐
colorFrom: purple
colorTo: blue
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: true
license: mit
---

# 🔐 CyberForge AI - ML Training Platform

**Train, Deploy, and Serve Cybersecurity Machine Learning Models**

A comprehensive platform for training cybersecurity ML models in the cloud with Hugging Face Spaces integration.

## 🚀 Features

- **📊 Model Training**: Upload datasets and train multiple ML models (Random Forest, Gradient Boosting, Neural Networks, Ensembles)
- **🤖 Multiple Security Tasks**: Malware detection, phishing detection, network intrusion, anomaly detection, and more
- **☁️ Cloud Training**: Leverage Hugging Face's infrastructure for training without local compute resources
- **🔗 API Integration**: RESTful API endpoints for backend integration
- **💾 Model Hub**: Upload trained models to Hugging Face Hub for sharing and deployment

## 📦 Supported Security Tasks

| Task | Description |
|------|-------------|
| Malware Detection | Identify malicious software patterns |
| Phishing Detection | Detect phishing URLs and emails |
| Network Intrusion Detection | Identify network attack patterns |
| Anomaly Detection | Detect unusual system behavior |
| Botnet Detection | Identify botnet command & control traffic |
| Web Attack Detection | Detect SQL injection, XSS, etc. |
| Spam Detection | Filter spam messages |
| Vulnerability Assessment | Assess system vulnerabilities |
| DNS Tunneling Detection | Detect DNS-based data exfiltration |
| Cryptomining Detection | Identify unauthorized mining activity |

## 🛠️ Model Types

- **Random Forest**: Robust ensemble classifier
- **Gradient Boosting**: High-performance gradient boosting
- **Logistic Regression**: Fast baseline classifier
- **Isolation Forest**: Unsupervised anomaly detection
- **Neural Networks**: Deep learning models (when available)
- **Ensemble Models**: Voting and stacking classifiers

## 📖 How to Use

### 1. Training a Model

1. Go to the **🎯 Train Model** tab
2. Upload your dataset (CSV, JSON, or Parquet)
3. Select the security task type
4. Choose a model type
5. Enter the target column name
6. Click **Train Model**

### 2. Running Inference

1. Go to the **🔮 Run Inference** tab
2. Enter the model ID from training
3. Provide input features as JSON
4. Click **Run Inference**

### 3. Backend Integration

```python
from gradio_client import Client

# Connect to the Space
client = Client("Che237/cyberforge")

# Train a model
result = client.predict(
    file="path/to/dataset.csv",
    task_type="Malware Detection",
    model_type="Random Forest",
    target_column="label",
    test_size=0.2,
    model_name="my_model",
    api_name="/train_model"
)

# Run inference
predictions = client.predict(
    model_id="my_model_malware_detection_20240101_120000",
    input_data='[{"feature1": 0.5, "feature2": 1.2}]',
    api_name="/run_inference"
)
```

### 4. Node.js Backend Integration

```javascript
const { Client } = require("@gradio/client");

async function runPrediction(modelId, features) {
    const client = await Client.connect("Che237/cyberforge");
    const result = await client.predict("/run_inference", {
        model_id: modelId,
        input_data: JSON.stringify([features])
    });
    return JSON.parse(result.data);
}

// Usage
const prediction = await runPrediction(
    "cyberforge_model_malware_detection_20240101",
    { src_bytes: 1000, dst_bytes: 500, protocol_type: 0 }
);
console.log(prediction);
```

## 📊 Dataset Format

Your dataset should be in CSV, JSON, or Parquet format with:

- **Features**: Numerical or categorical columns
- **Target**: A column indicating the class/label (e.g., `label`, `is_malicious`, `attack_type`)

### Example CSV Structure:

```csv
src_bytes,dst_bytes,protocol_type,service,flag,label
1000,500,tcp,http,SF,normal
5000,2000,udp,dns,REJ,attack
...
```

## 🔗 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/train_model` | POST | Train a new model |
| `/run_inference` | POST | Run predictions |
| `/list_trained_models` | GET | List available models |
| `/upload_model_to_hub` | POST | Upload model to Hub |
| `/download_model_from_hub` | POST | Download model from Hub |

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Your Backend  │ ──▶ │  HF Space (API)  │ ──▶ │  Trained Models │
│   (Node.js)     │ ◀── │  (Gradio)        │ ◀── │  (pkl files)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Hugging Face    │
                        │  Model Hub       │
                        └──────────────────┘
```

## 📁 Files

- `app.py` - Main Gradio application
- `trainer.py` - Advanced model training module
- `hf_client.py` - Client library for backend integration
- `requirements.txt` - Python dependencies

## 🔧 Local Development

```bash
# Clone the space
git clone https://huggingface.co/spaces/Che237/cyberforge

# Install dependencies
pip install -r requirements.txt

# Run locally
python app.py
```

## 📄 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ for the cybersecurity community
