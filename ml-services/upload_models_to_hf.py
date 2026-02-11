#!/usr/bin/env python3
"""
Upload trained models to HuggingFace Hub.
Run after notebook 03_model_training.ipynb to persist models.

Usage:
    export HF_TOKEN=hf_xxxxx
    python upload_models_to_hf.py
"""

import os
import sys
import json
from pathlib import Path

try:
    from huggingface_hub import HfApi, login, create_repo
except ImportError:
    print("Installing huggingface_hub...")
    os.system(f"{sys.executable} -m pip install -q huggingface_hub")
    from huggingface_hub import HfApi, login, create_repo

# Configuration
HF_TOKEN = os.environ.get("HF_TOKEN", "")
HF_REPO = os.environ.get("HF_MODEL_REPO", "Che237/cyberforge-models")

# Find models directory
POSSIBLE_DIRS = [
    Path("./models"),
    Path("../models"),
    Path("./datasets/../models"),
    Path(__file__).parent / "models",
]

MODELS_DIR = None
for d in POSSIBLE_DIRS:
    if d.exists() and any(d.glob("*/*.pkl")):
        MODELS_DIR = d.resolve()
        break

if not MODELS_DIR:
    # Check if notebooks produced models
    for d in POSSIBLE_DIRS:
        candidate = d.resolve()
        if candidate.exists():
            MODELS_DIR = candidate
            break

def main():
    print("=" * 60)
    print("CyberForge - Upload Trained Models to HuggingFace")
    print("=" * 60)

    if not HF_TOKEN:
        print("❌ HF_TOKEN not set!")
        print("   export HF_TOKEN=hf_your_token")
        sys.exit(1)

    # Login
    login(token=HF_TOKEN)
    api = HfApi()
    print(f"✓ Authenticated to HuggingFace")

    # Create or verify repo
    try:
        create_repo(HF_REPO, repo_type="model", exist_ok=True)
        print(f"✓ Repository: {HF_REPO}")
    except Exception as e:
        print(f"  Repo note: {e}")

    if not MODELS_DIR or not MODELS_DIR.exists():
        print(f"❌ Models directory not found. Checked: {[str(d) for d in POSSIBLE_DIRS]}")
        sys.exit(1)

    print(f"✓ Models directory: {MODELS_DIR}")

    # Find all model files
    pkl_files = list(MODELS_DIR.rglob("*.pkl"))
    json_files = list(MODELS_DIR.rglob("*.json"))
    py_files = list(MODELS_DIR.rglob("*.py"))

    all_files = pkl_files + json_files + py_files

    if not all_files:
        print(f"❌ No model files found in {MODELS_DIR}")
        print("   Run notebooks 02 and 03 first to train models.")
        sys.exit(1)

    print(f"\nFound {len(all_files)} files to upload:")
    for f in all_files:
        rel = f.relative_to(MODELS_DIR)
        size_kb = f.stat().st_size / 1024
        print(f"  📦 {rel} ({size_kb:.1f} KB)")

    # Upload all files
    print(f"\nUploading to {HF_REPO}...")
    
    uploaded = 0
    for f in all_files:
        rel_path = str(f.relative_to(MODELS_DIR))
        try:
            api.upload_file(
                path_or_fileobj=str(f),
                path_in_repo=rel_path,
                repo_id=HF_REPO,
                repo_type="model",
                commit_message=f"Upload {rel_path}"
            )
            uploaded += 1
            print(f"  ✓ {rel_path}")
        except Exception as e:
            print(f"  ✗ {rel_path}: {e}")

    # Also upload inference code
    inference_file = MODELS_DIR / "inference.py"
    if inference_file.exists():
        try:
            api.upload_file(
                path_or_fileobj=str(inference_file),
                path_in_repo="inference.py",
                repo_id=HF_REPO,
                repo_type="model",
            )
            print(f"  ✓ inference.py")
            uploaded += 1
        except:
            pass

    # Upload model registry
    registry_file = MODELS_DIR / "model_registry.json"
    if registry_file.exists():
        try:
            api.upload_file(
                path_or_fileobj=str(registry_file),
                path_in_repo="model_registry.json",
                repo_id=HF_REPO,
                repo_type="model",
            )
            print(f"  ✓ model_registry.json")
            uploaded += 1
        except:
            pass

    print(f"\n{'=' * 60}")
    print(f"✅ Upload complete: {uploaded}/{len(all_files)} files")
    print(f"📦 Repository: https://huggingface.co/{HF_REPO}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
