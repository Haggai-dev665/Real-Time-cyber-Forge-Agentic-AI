"""
CyberForge AI - ML Training & Inference Platform
Hugging Face Spaces deployment with Notebook execution support
"""

import gradio as gr
import pandas as pd
import numpy as np
import json
import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime
import logging
from typing import Dict, List, Any, Optional, Tuple

# ML Libraries
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score, f1_score
import joblib

# Hugging Face Hub
from huggingface_hub import HfApi, hf_hub_download, upload_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

MODELS_DIR = Path("./trained_models")
MODELS_DIR.mkdir(exist_ok=True)

DATASETS_DIR = Path("./datasets")
DATASETS_DIR.mkdir(exist_ok=True)

NOTEBOOKS_DIR = Path("./notebooks")

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
# NOTEBOOK EXECUTION
# ============================================================================

def get_available_notebooks() -> List[str]:
    """Get list of available notebooks"""
    if not NOTEBOOKS_DIR.exists():
        return []
    
    notebooks = sorted([
        f.name for f in NOTEBOOKS_DIR.glob("*.ipynb")
    ])
    return notebooks

def read_notebook_content(notebook_name: str) -> str:
    """Read and display notebook content as markdown"""
    notebook_path = NOTEBOOKS_DIR / notebook_name
    if not notebook_path.exists():
        return f"Notebook not found: {notebook_name}"
    
    try:
        with open(notebook_path, 'r') as f:
            nb = json.load(f)
        
        output = f"# {notebook_name}\n\n"
        
        for i, cell in enumerate(nb.get('cells', []), 1):
            cell_type = cell.get('cell_type', 'code')
            source = ''.join(cell.get('source', []))
            
            if cell_type == 'markdown':
                output += f"{source}\n\n"
            else:
                output += f"### Cell {i} (Python)\n```python\n{source}\n```\n\n"
        
        return output
    except Exception as e:
        return f"Error reading notebook: {str(e)}"

def execute_notebook(notebook_name: str, progress=gr.Progress()) -> Tuple[str, str]:
    """Execute a notebook and return output"""
    notebook_path = NOTEBOOKS_DIR / notebook_name
    output_path = NOTEBOOKS_DIR / f"output_{notebook_name}"
    
    if not notebook_path.exists():
        return f"Error: Notebook not found: {notebook_name}", ""
    
    progress(0.1, desc="Starting notebook execution...")
    
    try:
        # Execute notebook using nbconvert
        cmd = [
            sys.executable, "-m", "nbconvert",
            "--to", "notebook",
            "--execute",
            "--output", str(output_path.name),
            "--ExecutePreprocessor.timeout=600",
            "--ExecutePreprocessor.kernel_name=python3",
            str(notebook_path)
        ]
        
        progress(0.3, desc="Executing cells...")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(NOTEBOOKS_DIR),
            timeout=900
        )
        
        progress(0.8, desc="Processing output...")
        
        if result.returncode == 0:
            # Read executed notebook for outputs
            if output_path.exists():
                with open(output_path, 'r') as f:
                    executed_nb = json.load(f)
                
                outputs = []
                for i, cell in enumerate(executed_nb.get('cells', []), 1):
                    if cell.get('cell_type') == 'code':
                        cell_outputs = cell.get('outputs', [])
                        for out in cell_outputs:
                            if 'text' in out:
                                text = ''.join(out['text'])
                                outputs.append(f"Cell {i}:\n{text}")
                            elif 'data' in out:
                                if 'text/plain' in out['data']:
                                    text = ''.join(out['data']['text/plain'])
                                    outputs.append(f"Cell {i}:\n{text}")
                
                progress(1.0, desc="Complete!")
                return "Notebook executed successfully!", "\n\n".join(outputs)
            else:
                return "Notebook executed but output file not found", result.stdout
        else:
            return f"Execution failed:\n{result.stderr}", result.stdout
            
    except subprocess.TimeoutExpired:
        return "Error: Notebook execution timed out (15 min limit)", ""
    except Exception as e:
        return f"Error executing notebook: {str(e)}", ""

def run_notebook_cell(notebook_name: str, cell_number: int) -> str:
    """Execute a single cell from a notebook"""
    notebook_path = NOTEBOOKS_DIR / notebook_name
    
    if not notebook_path.exists():
        return f"Error: Notebook not found"
    
    try:
        with open(notebook_path, 'r') as f:
            nb = json.load(f)
        
        cells = [c for c in nb.get('cells', []) if c.get('cell_type') == 'code']
        
        if cell_number < 1 or cell_number > len(cells):
            return f"Error: Cell {cell_number} not found. Available: 1-{len(cells)}"
        
        cell = cells[cell_number - 1]
        source = ''.join(cell.get('source', []))
        
        # Execute the code
        import io
        from contextlib import redirect_stdout, redirect_stderr
        
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()
        
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            try:
                exec(source, globals())
            except Exception as e:
                return f"Error: {str(e)}"
        
        output = stdout_capture.getvalue()
        errors = stderr_capture.getvalue()
        
        result = f"### Cell {cell_number} Output:\n"
        if output:
            result += f"```\n{output}\n```\n"
        if errors:
            result += f"\n**Warnings/Errors:**\n```\n{errors}\n```"
        if not output and not errors:
            result += "*(No output)*"
        
        return result
        
    except Exception as e:
        return f"Error: {str(e)}"

# ============================================================================
# MODEL TRAINING (existing functionality)
# ============================================================================

class SecurityModelTrainer:
    """Train ML models for cybersecurity tasks"""
    
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.models = {}
    
    def prepare_data(self, df: pd.DataFrame, target_col: str = 'label') -> Tuple:
        """Prepare data for training"""
        if target_col not in df.columns:
            raise ValueError(f"Target column '{target_col}' not found")
        
        X = df.drop(columns=[target_col])
        y = df[target_col]
        
        # Handle categorical columns
        X = X.select_dtypes(include=[np.number]).fillna(0)
        
        if y.dtype == 'object':
            y = self.label_encoder.fit_transform(y)
        
        X_scaled = self.scaler.fit_transform(X)
        
        return train_test_split(X_scaled, y, test_size=0.2, random_state=42)
    
    def train_model(self, model_type: str, X_train, y_train):
        """Train a model"""
        if model_type not in MODEL_TYPES:
            raise ValueError(f"Unknown model type: {model_type}")
        
        model_class = MODEL_TYPES[model_type]
        
        if model_type == "Isolation Forest (Anomaly)":
            model = model_class(contamination=0.1, random_state=42)
        else:
            model = model_class(random_state=42)
        
        model.fit(X_train, y_train)
        return model
    
    def evaluate_model(self, model, X_test, y_test) -> Dict:
        """Evaluate model performance"""
        y_pred = model.predict(X_test)
        
        metrics = {
            'accuracy': accuracy_score(y_test, y_pred),
            'f1_score': f1_score(y_test, y_pred, average='weighted', zero_division=0)
        }
        
        return metrics

trainer = SecurityModelTrainer()

def train_model_from_data(data_file, model_type: str, task: str, progress=gr.Progress()):
    """Train model from uploaded data"""
    if data_file is None:
        return "Please upload a CSV file", None, None
    
    progress(0.1, desc="Loading data...")
    
    try:
        df = pd.read_csv(data_file.name)
        progress(0.3, desc="Preparing data...")
        
        X_train, X_test, y_train, y_test = trainer.prepare_data(df)
        
        progress(0.5, desc=f"Training {model_type}...")
        model = trainer.train_model(model_type, X_train, y_train)
        
        progress(0.8, desc="Evaluating model...")
        metrics = trainer.evaluate_model(model, X_test, y_test)
        
        # Save model
        model_name = f"{task.lower().replace(' ', '_')}_{model_type.lower().replace(' ', '_')}"
        model_path = MODELS_DIR / f"{model_name}.pkl"
        joblib.dump(model, model_path)
        
        progress(1.0, desc="Complete!")
        
        result = f"""
## Training Complete!

**Task:** {task}
**Model:** {model_type}
**Samples:** {len(df)}

### Metrics
- Accuracy: {metrics['accuracy']:.4f}
- F1 Score: {metrics['f1_score']:.4f}

**Model saved to:** {model_path}
"""
        
        return result, str(model_path), json.dumps(metrics, indent=2)
        
    except Exception as e:
        return f"Error: {str(e)}", None, None

def run_inference(model_file, features_text: str):
    """Run inference with a trained model"""
    if model_file is None:
        return "Please upload a model file"
    
    try:
        model = joblib.load(model_file.name)
        
        features = json.loads(features_text)
        X = np.array([list(features.values())])
        
        prediction = model.predict(X)[0]
        
        result = {
            'prediction': int(prediction),
            'features_used': len(features)
        }
        
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(X)[0]
            result['confidence'] = float(max(proba))
        
        return json.dumps(result, indent=2)
        
    except Exception as e:
        return f"Error: {str(e)}"

def list_trained_models():
    """List all trained models"""
    models = list(MODELS_DIR.glob("*.pkl"))
    if not models:
        return "No trained models found"
    
    output = "## Trained Models\n\n"
    for model_path in models:
        size_kb = model_path.stat().st_size / 1024
        output += f"- **{model_path.name}** ({size_kb:.1f} KB)\n"
    
    return output

# ============================================================================
# GRADIO INTERFACE
# ============================================================================

def create_interface():
    """Create the Gradio interface"""
    
    with gr.Blocks(title="CyberForge AI", theme=gr.themes.Soft()) as demo:
        gr.Markdown("""
# 🔐 CyberForge AI - ML Training Platform

Train cybersecurity ML models and run Jupyter notebooks on Hugging Face.
        """)
        
        with gr.Tabs():
            # ============ NOTEBOOKS TAB ============
            with gr.TabItem("📓 Notebooks"):
                gr.Markdown("""
### Run ML Pipeline Notebooks
Execute the CyberForge ML notebooks directly in the cloud.
                """)
                
                with gr.Row():
                    with gr.Column(scale=1):
                        notebook_dropdown = gr.Dropdown(
                            choices=get_available_notebooks(),
                            label="Select Notebook",
                            value=get_available_notebooks()[0] if get_available_notebooks() else None
                        )
                        
                        refresh_btn = gr.Button("🔄 Refresh List")
                        view_btn = gr.Button("👁 View Content", variant="secondary")
                        execute_btn = gr.Button("▶ Execute Notebook", variant="primary")
                        
                        gr.Markdown("### Run Single Cell")
                        cell_number = gr.Number(label="Cell Number", value=1, minimum=1)
                        run_cell_btn = gr.Button("Run Cell")
                    
                    with gr.Column(scale=2):
                        notebook_status = gr.Markdown("Select a notebook to view or execute.")
                        notebook_output = gr.Markdown("", label="Output")
                
                def refresh_notebooks():
                    notebooks = get_available_notebooks()
                    return gr.update(choices=notebooks, value=notebooks[0] if notebooks else None)
                
                refresh_btn.click(refresh_notebooks, outputs=notebook_dropdown)
                view_btn.click(read_notebook_content, inputs=notebook_dropdown, outputs=notebook_output)
                execute_btn.click(execute_notebook, inputs=notebook_dropdown, outputs=[notebook_status, notebook_output])
                run_cell_btn.click(run_notebook_cell, inputs=[notebook_dropdown, cell_number], outputs=notebook_output)
            
            # ============ TRAIN MODEL TAB ============
            with gr.TabItem("🎯 Train Model"):
                gr.Markdown("""
### Train a Security ML Model
Upload your dataset and train a model for threat detection.
                """)
                
                with gr.Row():
                    with gr.Column():
                        task_dropdown = gr.Dropdown(
                            choices=SECURITY_TASKS,
                            label="Security Task",
                            value="Phishing Detection"
                        )
                        model_dropdown = gr.Dropdown(
                            choices=list(MODEL_TYPES.keys()),
                            label="Model Type",
                            value="Random Forest"
                        )
                        data_upload = gr.File(label="Upload Training Data (CSV)", file_types=[".csv"])
                        train_btn = gr.Button("🚀 Train Model", variant="primary")
                    
                    with gr.Column():
                        train_output = gr.Markdown("Upload data and click Train to begin.")
                        model_path_output = gr.Textbox(label="Model Path", visible=False)
                        metrics_output = gr.Textbox(label="Metrics JSON", visible=False)
                
                train_btn.click(
                    train_model_from_data,
                    inputs=[data_upload, model_dropdown, task_dropdown],
                    outputs=[train_output, model_path_output, metrics_output]
                )
            
            # ============ INFERENCE TAB ============
            with gr.TabItem("🔍 Inference"):
                gr.Markdown("""
### Run Model Inference
Load a trained model and make predictions.
                """)
                
                with gr.Row():
                    with gr.Column():
                        model_upload = gr.File(label="Upload Model (.pkl)")
                        features_input = gr.Textbox(
                            label="Features (JSON)",
                            value='{"url_length": 50, "has_https": 1, "digit_count": 5}',
                            lines=5
                        )
                        predict_btn = gr.Button("🎯 Predict", variant="primary")
                    
                    with gr.Column():
                        prediction_output = gr.Textbox(label="Prediction Result", lines=10)
                
                predict_btn.click(run_inference, inputs=[model_upload, features_input], outputs=prediction_output)
            
            # ============ MODELS TAB ============
            with gr.TabItem("📦 Models"):
                gr.Markdown("### Trained Models")
                models_list = gr.Markdown(list_trained_models())
                refresh_models_btn = gr.Button("🔄 Refresh")
                refresh_models_btn.click(list_trained_models, outputs=models_list)
            
            # ============ API TAB ============
            with gr.TabItem("🔌 API"):
                gr.Markdown("""
## API Integration

### Python Client

```python
from huggingface_hub import InferenceClient

client = InferenceClient("Che237/cyberforge")

# Make prediction
result = client.predict(
    model_name="phishing_detection",
    features={"url_length": 50, "has_https": 1}
)
print(result)
```

### REST API

```bash
curl -X POST https://che237-cyberforge.hf.space/api/predict \\
  -H "Content-Type: application/json" \\
  -d '{"model_name": "phishing_detection", "features": {"url_length": 50}}'
```

### Notebook Execution

The notebooks in this Space implement the complete CyberForge ML pipeline:

| # | Notebook | Purpose |
|---|----------|---------|
| 00 | environment_setup | System validation |
| 01 | data_acquisition | Data collection |
| 02 | feature_engineering | Feature extraction |
| 03 | model_training | Train models |
| 04 | agent_intelligence | AI reasoning |
| 05 | model_validation | Testing |
| 06 | backend_integration | API packaging |
| 07 | deployment_artifacts | Deployment |
                """)
        
        gr.Markdown("""
---
**CyberForge AI** | [GitHub](https://github.com/Che237/cyberforge) | [Datasets](https://huggingface.co/datasets/Che237/cyberforge-datasets)
        """)
    
    return demo

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    demo = create_interface()
    demo.launch()
