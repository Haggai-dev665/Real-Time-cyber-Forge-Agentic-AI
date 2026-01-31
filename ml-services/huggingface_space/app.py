"""
🔐 CyberForge AI - ML Training & Inference Platform
Hugging Face Spaces deployment for training cybersecurity ML models
"""

import gradio as gr
import pandas as pd
import numpy as np
import json
import os
import joblib
from pathlib import Path
from datetime import datetime
import logging
from typing import Dict, List, Any, Optional, Tuple
import asyncio

# ML Libraries
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
import torch
import torch.nn as nn
from transformers import AutoTokenizer, AutoModel

# Hugging Face Hub
from huggingface_hub import HfApi, hf_hub_download, upload_file, create_repo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

MODELS_DIR = Path("./trained_models")
MODELS_DIR.mkdir(exist_ok=True)

DATASETS_DIR = Path("./datasets")
DATASETS_DIR.mkdir(exist_ok=True)

# Model types available for training
MODEL_TYPES = {
    "Random Forest": RandomForestClassifier,
    "Gradient Boosting": GradientBoostingClassifier,
    "Logistic Regression": LogisticRegression,
    "Isolation Forest (Anomaly)": IsolationForest,
}

# Cybersecurity task categories
SECURITY_TASKS = [
    "Malware Detection",
    "Phishing Detection", 
    "Network Intrusion Detection",
    "Anomaly Detection",
    "Botnet Detection",
    "Web Attack Detection",
    "Spam Detection",
    "Vulnerability Assessment",
    "DNS Tunneling Detection",
    "Cryptomining Detection",
]

# ============================================================================
# MODEL REGISTRY
# ============================================================================

class ModelRegistry:
    """Manages trained models and their metadata"""
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.metadata = {}
        self.registry_file = MODELS_DIR / "registry.json"
        self._load_registry()
    
    def _load_registry(self):
        """Load existing model registry"""
        if self.registry_file.exists():
            with open(self.registry_file, 'r') as f:
                self.metadata = json.load(f)
        else:
            self.metadata = {}
    
    def _save_registry(self):
        """Save model registry"""
        with open(self.registry_file, 'w') as f:
            json.dump(self.metadata, f, indent=2, default=str)
    
    def register_model(self, model_id: str, model, scaler, metrics: Dict):
        """Register a trained model"""
        self.models[model_id] = model
        self.scalers[model_id] = scaler
        
        # Save model and scaler
        model_path = MODELS_DIR / f"{model_id}_model.pkl"
        scaler_path = MODELS_DIR / f"{model_id}_scaler.pkl"
        
        joblib.dump(model, model_path)
        joblib.dump(scaler, scaler_path)
        
        # Update metadata
        self.metadata[model_id] = {
            "created_at": datetime.now().isoformat(),
            "metrics": metrics,
            "model_path": str(model_path),
            "scaler_path": str(scaler_path),
            "status": "ready"
        }
        self._save_registry()
        
        return model_id
    
    def get_model(self, model_id: str):
        """Load a model from registry"""
        if model_id in self.models:
            return self.models[model_id], self.scalers[model_id]
        
        if model_id in self.metadata:
            model = joblib.load(self.metadata[model_id]["model_path"])
            scaler = joblib.load(self.metadata[model_id]["scaler_path"])
            self.models[model_id] = model
            self.scalers[model_id] = scaler
            return model, scaler
        
        return None, None
    
    def list_models(self) -> List[Dict]:
        """List all registered models"""
        return [
            {"id": k, **v} for k, v in self.metadata.items()
        ]

# Global registry
model_registry = ModelRegistry()

# ============================================================================
# TRAINING FUNCTIONS
# ============================================================================

def prepare_dataset(file, task_type: str) -> Tuple[pd.DataFrame, str]:
    """Load and prepare dataset for training"""
    try:
        if file is None:
            return None, "No file uploaded"
        
        # Load based on file type
        if file.name.endswith('.csv'):
            df = pd.read_csv(file.name)
        elif file.name.endswith('.json'):
            df = pd.read_json(file.name)
        elif file.name.endswith('.parquet'):
            df = pd.read_parquet(file.name)
        else:
            return None, f"Unsupported file format: {file.name}"
        
        logger.info(f"Loaded dataset with shape: {df.shape}")
        return df, f"✅ Loaded dataset with {len(df)} samples and {len(df.columns)} features"
    
    except Exception as e:
        logger.error(f"Error loading dataset: {e}")
        return None, f"❌ Error: {str(e)}"


def train_model(
    file,
    task_type: str,
    model_type: str,
    target_column: str,
    test_size: float,
    model_name: str,
    progress=gr.Progress()
) -> Tuple[str, str, str]:
    """Train a machine learning model"""
    try:
        progress(0, desc="Loading dataset...")
        
        # Load dataset
        df, msg = prepare_dataset(file, task_type)
        if df is None:
            return msg, "", ""
        
        progress(0.1, desc="Preparing features...")
        
        # Validate target column
        if target_column not in df.columns:
            return f"❌ Target column '{target_column}' not found in dataset. Available: {list(df.columns)}", "", ""
        
        # Prepare features and target
        X = df.drop(columns=[target_column])
        y = df[target_column]
        
        # Handle categorical features
        for col in X.select_dtypes(include=['object', 'category']).columns:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
        
        # Handle target encoding
        if y.dtype == 'object' or y.dtype.name == 'category':
            le = LabelEncoder()
            y = le.fit_transform(y.astype(str))
        
        # Fill NaN values
        X = X.fillna(0)
        
        progress(0.2, desc="Splitting data...")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        
        progress(0.3, desc="Scaling features...")
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        progress(0.4, desc=f"Training {model_type}...")
        
        # Get model class
        if model_type not in MODEL_TYPES:
            return f"❌ Unknown model type: {model_type}", "", ""
        
        model_class = MODEL_TYPES[model_type]
        
        # Configure and train model
        if model_type == "Isolation Forest (Anomaly)":
            model = model_class(contamination=0.1, random_state=42, n_estimators=100)
            model.fit(X_train_scaled)
            y_pred = model.predict(X_test_scaled)
            y_pred = np.where(y_pred == -1, 1, 0)  # Convert to binary
        else:
            model = model_class(random_state=42)
            model.fit(X_train_scaled, y_train)
            y_pred = model.predict(X_test_scaled)
        
        progress(0.7, desc="Evaluating model...")
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average='weighted')
        
        metrics = {
            "accuracy": float(accuracy),
            "f1_score": float(f1),
            "model_type": model_type,
            "task_type": task_type,
            "samples": len(df),
            "features": len(X.columns),
        }
        
        progress(0.85, desc="Saving model...")
        
        # Generate model ID
        model_id = f"{model_name}_{task_type.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Register model
        model_registry.register_model(model_id, model, scaler, metrics)
        
        progress(1.0, desc="Complete!")
        
        # Format results
        training_log = f"""
## 🎯 Training Complete!

**Model ID:** `{model_id}`
**Task:** {task_type}
**Model Type:** {model_type}

### 📊 Dataset Info
- Samples: {len(df):,}
- Features: {len(X.columns)}
- Train/Test Split: {int((1-test_size)*100)}/{int(test_size*100)}

### 📈 Metrics
- **Accuracy:** {accuracy:.4f} ({accuracy*100:.2f}%)
- **F1 Score:** {f1:.4f}

### 💾 Model Saved
- Path: `{MODELS_DIR / f'{model_id}_model.pkl'}`
"""
        
        # Generate classification report
        try:
            report = classification_report(y_test, y_pred)
        except:
            report = "Classification report not available for this model type"
        
        return training_log, report, model_id
        
    except Exception as e:
        logger.error(f"Training error: {e}")
        import traceback
        return f"❌ Training failed: {str(e)}\n\n{traceback.format_exc()}", "", ""


def list_trained_models() -> str:
    """List all trained models"""
    models = model_registry.list_models()
    
    if not models:
        return "No models trained yet. Upload a dataset and train a model to get started!"
    
    output = "## 🤖 Trained Models\n\n"
    for model in models:
        output += f"""
### {model['id']}
- **Created:** {model.get('created_at', 'Unknown')}
- **Accuracy:** {model.get('metrics', {}).get('accuracy', 0):.4f}
- **F1 Score:** {model.get('metrics', {}).get('f1_score', 0):.4f}
- **Status:** {model.get('status', 'Unknown')}

---
"""
    return output


def run_inference(model_id: str, input_data: str) -> str:
    """Run inference on a trained model"""
    try:
        model, scaler = model_registry.get_model(model_id)
        
        if model is None:
            return f"❌ Model '{model_id}' not found"
        
        # Parse input data (expect JSON format)
        try:
            data = json.loads(input_data)
            if isinstance(data, dict):
                data = [data]
            df = pd.DataFrame(data)
        except json.JSONDecodeError:
            return "❌ Invalid JSON input. Please provide data in JSON format."
        
        # Scale and predict
        X_scaled = scaler.transform(df.fillna(0))
        predictions = model.predict(X_scaled)
        
        # Get probabilities if available
        try:
            probabilities = model.predict_proba(X_scaled)
            results = []
            for i, (pred, probs) in enumerate(zip(predictions, probabilities)):
                results.append({
                    "sample": i,
                    "prediction": int(pred),
                    "confidence": float(max(probs)),
                    "probabilities": probs.tolist()
                })
        except:
            results = [{"sample": i, "prediction": int(p)} for i, p in enumerate(predictions)]
        
        return json.dumps(results, indent=2)
        
    except Exception as e:
        logger.error(f"Inference error: {e}")
        return f"❌ Inference failed: {str(e)}"


# ============================================================================
# HUGGING FACE INTEGRATION
# ============================================================================

def upload_model_to_hub(model_id: str, repo_id: str, hf_token: str) -> str:
    """Upload a trained model to Hugging Face Hub"""
    try:
        if not hf_token:
            return "❌ Hugging Face token required for upload"
        
        model, scaler = model_registry.get_model(model_id)
        if model is None:
            return f"❌ Model '{model_id}' not found"
        
        api = HfApi(token=hf_token)
        
        # Create repo if it doesn't exist
        try:
            create_repo(repo_id, token=hf_token, repo_type="model", exist_ok=True)
        except Exception as e:
            logger.warning(f"Repo creation note: {e}")
        
        # Upload model files
        model_path = MODELS_DIR / f"{model_id}_model.pkl"
        scaler_path = MODELS_DIR / f"{model_id}_scaler.pkl"
        
        upload_file(
            path_or_fileobj=str(model_path),
            path_in_repo=f"{model_id}_model.pkl",
            repo_id=repo_id,
            token=hf_token,
            repo_type="model"
        )
        
        upload_file(
            path_or_fileobj=str(scaler_path),
            path_in_repo=f"{model_id}_scaler.pkl",
            repo_id=repo_id,
            token=hf_token,
            repo_type="model"
        )
        
        # Upload metadata
        metadata = model_registry.metadata.get(model_id, {})
        metadata_json = json.dumps(metadata, indent=2, default=str)
        
        with open(MODELS_DIR / f"{model_id}_metadata.json", 'w') as f:
            f.write(metadata_json)
        
        upload_file(
            path_or_fileobj=str(MODELS_DIR / f"{model_id}_metadata.json"),
            path_in_repo=f"{model_id}_metadata.json",
            repo_id=repo_id,
            token=hf_token,
            repo_type="model"
        )
        
        return f"""
## ✅ Model Uploaded Successfully!

**Model ID:** `{model_id}`
**Repository:** `{repo_id}`
**URL:** https://huggingface.co/{repo_id}

### Files Uploaded:
- `{model_id}_model.pkl`
- `{model_id}_scaler.pkl`
- `{model_id}_metadata.json`

You can now use this model from the Hub!
"""
        
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return f"❌ Upload failed: {str(e)}"


def download_model_from_hub(repo_id: str, model_filename: str, hf_token: str) -> str:
    """Download a model from Hugging Face Hub"""
    try:
        model_path = hf_hub_download(
            repo_id=repo_id,
            filename=model_filename,
            token=hf_token if hf_token else None
        )
        
        # Also try to download scaler
        scaler_filename = model_filename.replace("_model.pkl", "_scaler.pkl")
        try:
            scaler_path = hf_hub_download(
                repo_id=repo_id,
                filename=scaler_filename,
                token=hf_token if hf_token else None
            )
        except:
            scaler_path = None
        
        # Load and register
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path) if scaler_path else StandardScaler()
        
        model_id = model_filename.replace("_model.pkl", "")
        model_registry.models[model_id] = model
        model_registry.scalers[model_id] = scaler
        
        return f"""
## ✅ Model Downloaded Successfully!

**Model ID:** `{model_id}`
**Source:** `{repo_id}`

The model is now available for inference.
"""
        
    except Exception as e:
        logger.error(f"Download error: {e}")
        return f"❌ Download failed: {str(e)}"


# ============================================================================
# API ENDPOINTS (For Backend Integration)
# ============================================================================

def api_predict(model_id: str, features: Dict) -> Dict:
    """API endpoint for predictions"""
    try:
        model, scaler = model_registry.get_model(model_id)
        if model is None:
            return {"error": f"Model '{model_id}' not found"}
        
        df = pd.DataFrame([features])
        X_scaled = scaler.transform(df.fillna(0))
        prediction = model.predict(X_scaled)[0]
        
        try:
            proba = model.predict_proba(X_scaled)[0]
            confidence = float(max(proba))
        except:
            confidence = None
        
        return {
            "model_id": model_id,
            "prediction": int(prediction),
            "confidence": confidence,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {"error": str(e)}


def api_batch_predict(model_id: str, batch_data: List[Dict]) -> List[Dict]:
    """API endpoint for batch predictions"""
    results = []
    for item in batch_data:
        result = api_predict(model_id, item)
        results.append(result)
    return results


# ============================================================================
# GRADIO INTERFACE
# ============================================================================

# Custom CSS
custom_css = """
.gradio-container {
    font-family: 'Inter', sans-serif;
}
.main-title {
    text-align: center;
    color: #1a1a2e;
    margin-bottom: 20px;
}
.tab-content {
    padding: 20px;
}
"""

# Build interface
with gr.Blocks(css=custom_css, title="CyberForge AI - ML Training Platform") as demo:
    gr.Markdown("""
    # 🔐 CyberForge AI - ML Training Platform
    
    **Train, Deploy, and Serve Cybersecurity ML Models**
    
    This platform enables you to:
    - 📊 Upload and train models on cybersecurity datasets
    - 🚀 Deploy models to Hugging Face Hub
    - 🔗 Integrate with your backend via API
    - 🤖 Run inference on trained models
    """)
    
    with gr.Tabs():
        # ==================== TRAINING TAB ====================
        with gr.TabItem("🎯 Train Model"):
            with gr.Row():
                with gr.Column(scale=1):
                    gr.Markdown("### Dataset Configuration")
                    
                    train_file = gr.File(
                        label="Upload Dataset (CSV, JSON, or Parquet)",
                        file_types=[".csv", ".json", ".parquet"]
                    )
                    
                    task_type = gr.Dropdown(
                        choices=SECURITY_TASKS,
                        value="Malware Detection",
                        label="Security Task Type"
                    )
                    
                    model_type = gr.Dropdown(
                        choices=list(MODEL_TYPES.keys()),
                        value="Random Forest",
                        label="Model Type"
                    )
                    
                    target_column = gr.Textbox(
                        label="Target Column Name",
                        placeholder="e.g., 'label', 'is_malicious', 'attack_type'"
                    )
                    
                    test_size = gr.Slider(
                        minimum=0.1,
                        maximum=0.4,
                        value=0.2,
                        step=0.05,
                        label="Test Size"
                    )
                    
                    model_name = gr.Textbox(
                        label="Model Name",
                        placeholder="e.g., 'malware_detector_v1'",
                        value="cyberforge_model"
                    )
                    
                    train_btn = gr.Button("🚀 Train Model", variant="primary")
                
                with gr.Column(scale=1):
                    gr.Markdown("### Training Results")
                    training_output = gr.Markdown()
                    classification_report_output = gr.Textbox(
                        label="Classification Report",
                        lines=10
                    )
                    trained_model_id = gr.Textbox(
                        label="Trained Model ID",
                        interactive=False
                    )
            
            train_btn.click(
                fn=train_model,
                inputs=[train_file, task_type, model_type, target_column, test_size, model_name],
                outputs=[training_output, classification_report_output, trained_model_id]
            )
        
        # ==================== INFERENCE TAB ====================
        with gr.TabItem("🔮 Run Inference"):
            with gr.Row():
                with gr.Column():
                    inference_model_id = gr.Textbox(
                        label="Model ID",
                        placeholder="Enter the model ID to use"
                    )
                    
                    inference_input = gr.Textbox(
                        label="Input Data (JSON format)",
                        placeholder='[{"feature1": 0.5, "feature2": 1.2, ...}]',
                        lines=5
                    )
                    
                    inference_btn = gr.Button("🔮 Run Inference", variant="primary")
                
                with gr.Column():
                    inference_output = gr.Textbox(
                        label="Predictions",
                        lines=10
                    )
            
            inference_btn.click(
                fn=run_inference,
                inputs=[inference_model_id, inference_input],
                outputs=[inference_output]
            )
        
        # ==================== MODELS TAB ====================
        with gr.TabItem("🤖 Models"):
            gr.Markdown("### Trained Models")
            
            refresh_btn = gr.Button("🔄 Refresh Models List")
            models_list = gr.Markdown()
            
            refresh_btn.click(
                fn=list_trained_models,
                outputs=[models_list]
            )
            
            # Auto-refresh on load
            demo.load(
                fn=list_trained_models,
                outputs=[models_list]
            )
        
        # ==================== HUB TAB ====================
        with gr.TabItem("☁️ Hugging Face Hub"):
            gr.Markdown("### Upload & Download Models")
            
            with gr.Row():
                with gr.Column():
                    gr.Markdown("#### Upload to Hub")
                    upload_model_id = gr.Textbox(
                        label="Model ID to Upload"
                    )
                    upload_repo_id = gr.Textbox(
                        label="Hub Repository ID",
                        placeholder="username/repo-name"
                    )
                    upload_token = gr.Textbox(
                        label="Hugging Face Token",
                        type="password"
                    )
                    upload_btn = gr.Button("⬆️ Upload Model", variant="primary")
                    upload_result = gr.Markdown()
                
                with gr.Column():
                    gr.Markdown("#### Download from Hub")
                    download_repo_id = gr.Textbox(
                        label="Hub Repository ID",
                        placeholder="username/repo-name"
                    )
                    download_filename = gr.Textbox(
                        label="Model Filename",
                        placeholder="model_name_model.pkl"
                    )
                    download_token = gr.Textbox(
                        label="Hugging Face Token (optional)",
                        type="password"
                    )
                    download_btn = gr.Button("⬇️ Download Model", variant="secondary")
                    download_result = gr.Markdown()
            
            upload_btn.click(
                fn=upload_model_to_hub,
                inputs=[upload_model_id, upload_repo_id, upload_token],
                outputs=[upload_result]
            )
            
            download_btn.click(
                fn=download_model_from_hub,
                inputs=[download_repo_id, download_filename, download_token],
                outputs=[download_result]
            )
        
        # ==================== API TAB ====================
        with gr.TabItem("🔗 API Integration"):
            gr.Markdown("""
            ### API Integration Guide
            
            Your backend can integrate with this Space using the Gradio Client library or direct API calls.
            
            #### Python Client Example:
            
            ```python
            from gradio_client import Client
            
            # Connect to your Space
            client = Client("Che237/cyberforge")
            
            # Run inference
            result = client.predict(
                model_id="your_model_id",
                input_data='[{"feature1": 0.5, "feature2": 1.2}]',
                api_name="/run_inference"
            )
            print(result)
            ```
            
            #### API Endpoints:
            
            | Endpoint | Description |
            |----------|-------------|
            | `/train_model` | Train a new model |
            | `/run_inference` | Run predictions |
            | `/list_trained_models` | List available models |
            | `/upload_model_to_hub` | Upload model to Hub |
            
            #### Backend Integration (Node.js):
            
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
            ```
            """)

# Launch the demo
if __name__ == "__main__":
    demo.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False
    )
