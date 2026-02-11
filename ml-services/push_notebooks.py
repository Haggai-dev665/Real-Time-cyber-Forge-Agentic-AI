#!/usr/bin/env python3
"""Push all notebooks to HF Space Che237/cyberforge"""

from huggingface_hub import HfApi
import os

token = "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"
api = HfApi(token=token)
repo_id = "Che237/cyberforge"

files_to_upload = [
    ("notebooks/notebook_config.json", "notebooks/notebook_config.json"),
    ("notebooks/00_environment_setup.ipynb", "notebooks/00_environment_setup.ipynb"),
    ("notebooks/01_data_acquisition.ipynb", "notebooks/01_data_acquisition.ipynb"),
    ("notebooks/02_feature_engineering.ipynb", "notebooks/02_feature_engineering.ipynb"),
    ("notebooks/03_model_training.ipynb", "notebooks/03_model_training.ipynb"),
    ("notebooks/04_agent_intelligence.ipynb", "notebooks/04_agent_intelligence.ipynb"),
    ("notebooks/05_model_validation.ipynb", "notebooks/05_model_validation.ipynb"),
    ("notebooks/06_backend_integration.ipynb", "notebooks/06_backend_integration.ipynb"),
    ("notebooks/07_deployment_artifacts.ipynb", "notebooks/07_deployment_artifacts.ipynb"),
    ("notebooks/README.md", "notebooks/README.md"),
]

print("Uploading notebooks to HF Space: Che237/cyberforge")
print("=" * 60)

uploaded = 0
for local_path, repo_path in files_to_upload:
    if os.path.exists(local_path):
        try:
            api.upload_file(
                path_or_fileobj=local_path,
                path_in_repo=repo_path,
                repo_id=repo_id,
                repo_type="space",
                commit_message=f"Update {repo_path} - fix configs and enable HF upload",
            )
            size_kb = os.path.getsize(local_path) / 1024
            print(f"  OK {repo_path} ({size_kb:.1f} KB)")
            uploaded += 1
        except Exception as e:
            print(f"  FAIL {repo_path}: {e}")
    else:
        print(f"  SKIP {local_path}: File not found")

print(f"\nUploaded {uploaded}/{len(files_to_upload)} files to https://huggingface.co/spaces/{repo_id}")
