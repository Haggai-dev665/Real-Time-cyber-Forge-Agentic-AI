import json
from pathlib import Path

# Fix notebook 02
nb_path = Path("/Users/Dadaicon/Documents/GitHub/Real-Time-cyber-Forge-Agentic-AI/ml-services/notebooks/02_feature_engineering.ipynb")

with open(nb_path, 'r') as f:
    nb = json.load(f)

# Fix cell 11 (index 11) - remove literal \n at end
for i, cell in enumerate(nb['cells']):
    if cell['cell_type'] == 'code':
        # Check each line for literal backslash-n at end
        new_source = []
        for line in cell['source']:
            # Remove trailing literal \n (not actual newline)
            if line.endswith('\\n'):
                line = line[:-2] + '\n'
            new_source.append(line)
        cell['source'] = new_source

with open(nb_path, 'w') as f:
    json.dump(nb, f, indent=1)

print("Fixed notebook 02 - removed literal \\n characters")

# Also fix notebook 03 the same way
nb03_path = Path("/Users/Dadaicon/Documents/GitHub/Real-Time-cyber-Forge-Agentic-AI/ml-services/notebooks/03_model_training.ipynb")

with open(nb03_path, 'r') as f:
    nb03 = json.load(f)

for i, cell in enumerate(nb03['cells']):
    if cell['cell_type'] == 'code':
        new_source = []
        for line in cell['source']:
            if line.endswith('\\n'):
                line = line[:-2] + '\n'
            new_source.append(line)
        cell['source'] = new_source

with open(nb03_path, 'w') as f:
    json.dump(nb03, f, indent=1)

print("Fixed notebook 03 - removed literal \\n characters")

# Upload both
from huggingface_hub import HfApi
api = HfApi(token='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')

api.upload_file(
    path_or_fileobj=str(nb_path),
    path_in_repo='notebooks/02_feature_engineering.ipynb',
    repo_id='Che237/cyberforge',
    repo_type='space',
    commit_message='Fix syntax error - remove literal backslash-n'
)
print("Uploaded notebook 02")

api.upload_file(
    path_or_fileobj=str(nb03_path),
    path_in_repo='notebooks/03_model_training.ipynb',
    repo_id='Che237/cyberforge',
    repo_type='space',
    commit_message='Fix syntax error - remove literal backslash-n'
)
print("Uploaded notebook 03")

print("Done!")
