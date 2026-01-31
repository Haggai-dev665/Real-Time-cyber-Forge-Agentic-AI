#!/usr/bin/env python3
"""Upload notebooks to Hugging Face Space"""

from huggingface_hub import HfApi, login
from pathlib import Path

# Login
token = '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'
login(token=token)
api = HfApi(token=token)

# Upload notebooks
notebooks_dir = Path('notebooks')
space_id = 'Che237/cyberforge'

notebooks = [
    '00_environment_setup.ipynb',
    '01_data_acquisition.ipynb',
    '02_feature_engineering.ipynb',
    '03_model_training.ipynb',
    '04_agent_intelligence.ipynb',
    '05_model_validation.ipynb',
    '06_backend_integration.ipynb',
    '07_deployment_artifacts.ipynb',
    'README.md'
]

# Also upload config
config_file = 'notebook_config.json'

print('Uploading notebooks to Hugging Face Space...')
for nb in notebooks:
    local_path = notebooks_dir / nb
    if local_path.exists():
        print(f'  Uploading: {nb}')
        try:
            api.upload_file(
                path_or_fileobj=str(local_path),
                path_in_repo=f'notebooks/{nb}',
                repo_id=space_id,
                repo_type='space',
                commit_message=f'Add {nb}'
            )
            print(f'    Success')
        except Exception as e:
            print(f'    Error: {e}')
    else:
        print(f'  Not found: {nb}')

# Upload config
print(f'  Uploading: {config_file}')
try:
    api.upload_file(
        path_or_fileobj=config_file,
        path_in_repo=f'notebooks/{config_file}',
        repo_id=space_id,
        repo_type='space',
        commit_message=f'Add {config_file}'
    )
    print(f'    Success')
except Exception as e:
    print(f'    Error: {e}')

print('\nDone! View at: https://huggingface.co/spaces/Che237/cyberforge')
