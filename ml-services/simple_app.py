"""
CyberForge AI - ML Training Platform
Simplified for HF Spaces compatibility
"""

import gradio as gr
import pandas as pd
import numpy as np
import json
import os
import subprocess
import sys
from pathlib import Path
import logging

# ML Libraries
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, f1_score
import joblib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Directories
MODELS_DIR = Path("./trained_models")
MODELS_DIR.mkdir(exist_ok=True)
NOTEBOOKS_DIR = Path("./notebooks")

# ============================================================================
# NOTEBOOK FUNCTIONS
# ============================================================================

def get_notebooks_list():
    """Get formatted list of notebooks"""
    if not NOTEBOOKS_DIR.exists():
        return "No notebooks directory found"
    
    notebooks = sorted(NOTEBOOKS_DIR.glob("*.ipynb"))
    if not notebooks:
        return "No notebooks found"
    
    output = "## Available Notebooks\n\n"
    for nb in notebooks:
        output += f"- **{nb.name}**\n"
    return output

def view_notebook(notebook_name):
    """View notebook content"""
    if not notebook_name:
        return "Please select a notebook"
    
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
                output += f"### Cell {i}\n```python\n{source}\n```\n\n"
        
        return output
    except Exception as e:
        return f"Error reading notebook: {str(e)}"

def execute_notebook(notebook_name):
    """Execute a notebook"""
    if not notebook_name:
        return "Please select a notebook", ""
    
    notebook_path = NOTEBOOKS_DIR / notebook_name
    if not notebook_path.exists():
        return f"Error: Notebook not found", ""
    
    try:
        output_name = f"executed_{notebook_name}"
        output_path = NOTEBOOKS_DIR / output_name
        
        cmd = [
            sys.executable, "-m", "nbconvert",
            "--to", "notebook",
            "--execute",
            "--output", output_name,
            "--ExecutePreprocessor.timeout=600",
            str(notebook_path)
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(NOTEBOOKS_DIR),
            timeout=900
        )
        
        if result.returncode == 0:
            # Read outputs
            if output_path.exists():
                with open(output_path, 'r') as f:
                    executed_nb = json.load(f)
                
                outputs = []
                for i, cell in enumerate(executed_nb.get('cells', []), 1):
                    if cell.get('cell_type') == 'code':
                        for out in cell.get('outputs', []):
                            if 'text' in out:
                                outputs.append(f"Cell {i}: {''.join(out['text'])}")
                            elif 'data' in out and 'text/plain' in out['data']:
                                outputs.append(f"Cell {i}: {''.join(out['data']['text/plain'])}")
                
                return "Success!", "\n\n".join(outputs) if outputs else "Notebook executed (no output)"
            return "Executed but no output file", ""
        else:
            return f"Error: {result.stderr[:500]}", ""
            
    except subprocess.TimeoutExpired:
        return "Timeout: Execution exceeded 15 minutes", ""
    except Exception as e:
        return f"Error: {str(e)}", ""

# ============================================================================
# TRAINING FUNCTIONS
# ============================================================================

def train_model(file_obj, model_type, task_name):
    """Train a model from uploaded CSV"""
    if file_obj is None:
        return "Please upload a CSV file"
    
    try:
        df = pd.read_csv(file_obj.name)
        
        # Find target column
        target_col = None
        for col in ['label', 'target', 'class', 'y']:
            if col in df.columns:
                target_col = col
                break
        
        if target_col is None:
            target_col = df.columns[-1]
        
        X = df.drop(columns=[target_col])
        y = df[target_col]
        
        # Numeric only
        X = X.select_dtypes(include=[np.number]).fillna(0)
        
        # Encode labels if needed
        le = LabelEncoder()
        if y.dtype == 'object':
            y = le.fit_transform(y)
        
        # Scale and split
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
        
        # Train
        if model_type == "Random Forest":
            model = RandomForestClassifier(n_estimators=100, random_state=42)
        elif model_type == "Gradient Boosting":
            model = GradientBoostingClassifier(random_state=42)
        else:
            model = LogisticRegression(random_state=42, max_iter=1000)
        
        model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        
        # Save
        model_name = f"{task_name.lower().replace(' ', '_')}_{model_type.lower().replace(' ', '_')}.pkl"
        model_path = MODELS_DIR / model_name
        joblib.dump({'model': model, 'scaler': scaler}, model_path)
        
        return f"""## Training Complete!

**Task:** {task_name}
**Model:** {model_type}
**Samples:** {len(df)}

### Metrics
- Accuracy: {acc:.4f}
- F1 Score: {f1:.4f}

**Saved to:** {model_path}
"""
        
    except Exception as e:
        return f"Error: {str(e)}"

def run_prediction(model_file, features_json):
    """Run inference"""
    if model_file is None:
        return "Please upload a model file"
    
    try:
        data = joblib.load(model_file.name)
        model = data.get('model', data)
        scaler = data.get('scaler', None)
        
        features = json.loads(features_json)
        X = np.array([list(features.values())])
        
        if scaler:
            X = scaler.transform(X)
        
        pred = model.predict(X)[0]
        
        result = {"prediction": int(pred)}
        
        if hasattr(model, 'predict_proba'):
            proba = model.predict_proba(X)[0]
            result["confidence"] = float(max(proba))
            result["probabilities"] = [float(p) for p in proba]
        
        return json.dumps(result, indent=2)
        
    except Exception as e:
        return f"Error: {str(e)}"

def list_models():
    """List trained models"""
    models = list(MODELS_DIR.glob("*.pkl"))
    if not models:
        return "No trained models found"
    
    output = "## Trained Models\n\n"
    for m in models:
        size_kb = m.stat().st_size / 1024
        output += f"- **{m.name}** ({size_kb:.1f} KB)\n"
    return output

# ============================================================================
# GRADIO INTERFACE
# ============================================================================

def create_app():
    with gr.Blocks(title="CyberForge AI", theme=gr.themes.Soft()) as demo:
        gr.Markdown("""
# 🔐 CyberForge AI - ML Training Platform

Train cybersecurity ML models and run notebooks on Hugging Face.
        """)
        
        with gr.Tabs():
            # Notebooks Tab
            with gr.TabItem("📓 Notebooks"):
                gr.Markdown("### ML Pipeline Notebooks")
                
                notebooks_info = gr.Markdown(get_notebooks_list())
                
                with gr.Row():
                    notebook_input = gr.Textbox(
                        label="Notebook Name",
                        placeholder="e.g., 00_environment_setup.ipynb"
                    )
                
                with gr.Row():
                    view_btn = gr.Button("👁 View Content")
                    exec_btn = gr.Button("▶ Execute", variant="primary")
                
                notebook_content = gr.Markdown(label="Content")
                exec_status = gr.Textbox(label="Status")
                exec_output = gr.Textbox(label="Output", lines=10)
                
                view_btn.click(view_notebook, inputs=notebook_input, outputs=notebook_content)
                exec_btn.click(execute_notebook, inputs=notebook_input, outputs=[exec_status, exec_output])
            
            # Training Tab
            with gr.TabItem("🎯 Train Model"):
                gr.Markdown("### Train a Security Model")
                
                with gr.Row():
                    with gr.Column():
                        task_input = gr.Textbox(label="Task Name", value="Phishing Detection")
                        model_choice = gr.Dropdown(
                            choices=["Random Forest", "Gradient Boosting", "Logistic Regression"],
                            label="Model Type",
                            value="Random Forest"
                        )
                        data_file = gr.File(label="Training Data (CSV)")
                        train_btn = gr.Button("🚀 Train", variant="primary")
                    
                    with gr.Column():
                        train_result = gr.Markdown()
                
                train_btn.click(
                    train_model,
                    inputs=[data_file, model_choice, task_input],
                    outputs=train_result
                )
            
            # Inference Tab
            with gr.TabItem("🔍 Inference"):
                gr.Markdown("### Run Predictions")
                
                with gr.Row():
                    with gr.Column():
                        model_file = gr.File(label="Model (.pkl)")
                        features_text = gr.Textbox(
                            label="Features (JSON)",
                            value='{"url_length": 50, "has_https": 1, "digit_count": 5}',
                            lines=5
                        )
                        predict_btn = gr.Button("🎯 Predict", variant="primary")
                    
                    with gr.Column():
                        pred_result = gr.Textbox(label="Result", lines=10)
                
                predict_btn.click(run_prediction, inputs=[model_file, features_text], outputs=pred_result)
            
            # Models Tab
            with gr.TabItem("📦 Models"):
                models_md = gr.Markdown(list_models())
                refresh_btn = gr.Button("🔄 Refresh")
                refresh_btn.click(list_models, outputs=models_md)
            
            # API Tab
            with gr.TabItem("🔌 API"):
                gr.Markdown("""
## API Integration

### Available Notebooks

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

### Links
- [Datasets](https://huggingface.co/datasets/Che237/cyberforge-datasets)
                """)
        
        gr.Markdown("---\n**CyberForge AI** | Cybersecurity ML Platform")
    
    return demo

# Main
if __name__ == "__main__":
    demo = create_app()
    demo.launch()
