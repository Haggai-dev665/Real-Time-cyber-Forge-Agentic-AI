#!/usr/bin/env python3
"""Upload updated notebooks to HF Space"""

from huggingface_hub import upload_file
import time

token = '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'
repo = 'Che237/cyberforge'

files_to_upload = [
    ('notebooks/notebook_config.json', 'notebooks/notebook_config.json'),
    ('notebooks/00_environment_setup.ipynb', 'notebooks/00_environment_setup.ipynb'),
]

for local_path, remote_path in files_to_upload:
    for attempt in range(3):
        try:
            print(f'Uploading {local_path}...')
            upload_file(
                path_or_fileobj=local_path,
                path_in_repo=remote_path,
                repo_id=repo,
                repo_type='space',
                token=token
            )
            print(f'  ✓ Done!')
            break
        except Exception as e:
            print(f'  Error: {e}')
            if attempt < 2:
                print('  Retrying in 5 seconds...')
                time.sleep(5)
            else:
                print('  Failed after 3 attempts')

print('\nUpload complete!')
print('Check: https://huggingface.co/spaces/Che237/cyberforge')
