#!/usr/bin/env python3
"""
Upload CyberForge datasets to Hugging Face
"""
from huggingface_hub import HfApi
import os

api = HfApi()
datasets_path = '/Users/Dadaicon/Documents/GitHub/Real-Time-cyber-Forge-Agentic-AI/ml-services/datasets'

# Get list of subdirectories (each dataset category)
categories = [d for d in os.listdir(datasets_path) if os.path.isdir(os.path.join(datasets_path, d))]

print('Uploading datasets by category...')
print(f'Found {len(categories)} categories: {categories}')
print()

uploaded = []
failed = []

for category in sorted(categories):
    category_path = os.path.join(datasets_path, category)
    print(f'Uploading {category}...')
    try:
        api.upload_folder(
            folder_path=category_path,
            path_in_repo=category,
            repo_id='Che237/cyberforge-datasets',
            repo_type='dataset',
            commit_message=f'Upload {category} dataset'
        )
        print(f'  [OK] {category} uploaded')
        uploaded.append(category)
    except Exception as e:
        print(f'  [WARN] {category}: {str(e)[:80]}')
        failed.append(category)

# Upload root metadata
print()
print('Uploading root metadata.json...')
try:
    api.upload_file(
        path_or_fileobj=os.path.join(datasets_path, 'metadata.json'),
        path_in_repo='metadata.json',
        repo_id='Che237/cyberforge-datasets',
        repo_type='dataset'
    )
    print('[OK] metadata.json uploaded')
except Exception as e:
    print(f'[WARN] metadata.json: {e}')

print()
print('=' * 50)
print('Upload Summary')
print('=' * 50)
print(f'Uploaded: {len(uploaded)} categories')
print(f'Failed: {len(failed)} categories')
if failed:
    print(f'Failed items: {failed}')
print()
print('View at: https://huggingface.co/datasets/Che237/cyberforge-datasets')
