import json
from pathlib import Path

notebooks_dir = Path("/Users/Dadaicon/Documents/GitHub/Real-Time-cyber-Forge-Agentic-AI/ml-services/notebooks")

notebooks_to_fix = [
    "01_data_acquisition.ipynb",
    "02_feature_engineering.ipynb",
    "03_model_training.ipynb",
    "04_agent_intelligence.ipynb",
    "05_model_validation.ipynb",
    "06_backend_integration.ipynb",
    "07_deployment_artifacts.ipynb"
]

for nb_name in notebooks_to_fix:
    nb_path = notebooks_dir / nb_name
    
    with open(nb_path, 'r') as f:
        nb = json.load(f)
    
    modified = False
    for cell in nb['cells']:
        if cell['cell_type'] == 'code':
            new_source = []
            skip_next_comment = False
            for line in cell['source']:
                if '# Load notebook config' in line and '../' not in line:
                    skip_next_comment = True
                    new_source.append(line)
                elif 'config_path = Path("../notebook_config.json")' in line:
                    new_source.append('# Load notebook config (same directory)\n')
                    new_source.append('config_path = Path("notebook_config.json")\n')
                    new_source.append('if not config_path.exists():\n')
                    new_source.append('    config_path = Path("/home/user/app/notebooks/notebook_config.json")\n')
                    modified = True
                else:
                    new_source.append(line)
            cell['source'] = new_source
    
    if modified:
        with open(nb_path, 'w') as f:
            json.dump(nb, f, indent=1)
        print(f"Fixed {nb_name}")
    else:
        print(f"Checked {nb_name} (no changes needed)")

print("\nDone! Now uploading to HF...")

from huggingface_hub import HfApi
api = HfApi(token='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')

for nb_name in notebooks_to_fix:
    nb_path = notebooks_dir / nb_name
    api.upload_file(
        path_or_fileobj=str(nb_path),
        path_in_repo=f'notebooks/{nb_name}',
        repo_id='Che237/cyberforge',
        repo_type='space'
    )
    print(f"Uploaded {nb_name}")

print("\nAll notebooks fixed and uploaded!")
