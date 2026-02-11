#!/usr/bin/env bash
# ============================================================
# Update CyberForge HF Space with FastAPI REST endpoints
# ============================================================
# This uploads ONLY app.py, Dockerfile, requirements.txt, README.md
# to your existing Che237/cyberforge Space.
# It preserves notebooks/, trainer.py, hf_client.py already there.
# ============================================================
# Usage:
#   export HF_TOKEN=hf_xxxxx
#   export GEMINI_API_KEY=AIzaSy...
#   bash deploy_hf_space.sh
# ============================================================

set -e

SPACE_REPO="Che237/cyberforge"
DEPLOY_DIR="$(cd "$(dirname "$0")/hf_space_deploy" && pwd)"

echo "🔐 CyberForge AI - Update HF Space with REST API"
echo "=================================================="

# Check HF_TOKEN
if [ -z "$HF_TOKEN" ]; then
    echo "❌ HF_TOKEN not set. Run: export HF_TOKEN=hf_your_token"
    exit 1
fi
echo "✓ HF_TOKEN is set"

# Check if huggingface-cli is available
if ! command -v huggingface-cli &> /dev/null; then
    echo "Installing huggingface_hub CLI..."
    pip install -q "huggingface_hub[cli]"
fi

# Login to HuggingFace
echo "Logging in to HuggingFace..."
huggingface-cli login --token "$HF_TOKEN" --add-to-git-credential

# Set Space secrets
echo ""
echo "Setting Space secrets..."
if [ -n "$GEMINI_API_KEY" ]; then
    python3 -c "
from huggingface_hub import HfApi
api = HfApi()
api.add_space_secret('$SPACE_REPO', 'GEMINI_API_KEY', '$GEMINI_API_KEY')
print('✓ GEMINI_API_KEY secret set')
"
else
    echo "⚠ GEMINI_API_KEY not set — Space will run Gemini in fallback mode"
fi

python3 -c "
from huggingface_hub import HfApi
api = HfApi()
api.add_space_secret('$SPACE_REPO', 'HF_TOKEN', '$HF_TOKEN')
api.add_space_secret('$SPACE_REPO', 'HF_MODEL_REPO', 'Che237/cyberforge-models')
api.add_space_secret('$SPACE_REPO', 'GEMINI_MODEL', 'gemini-2.0-flash-exp')
print('✓ HF_TOKEN, HF_MODEL_REPO, GEMINI_MODEL secrets set')
"

# Upload only the key files (preserves existing notebooks, trainer, hf_client)
echo ""
echo "Uploading updated files to Space..."
python3 -c "
from huggingface_hub import HfApi
api = HfApi()

files = ['app.py', 'Dockerfile', 'requirements.txt', 'README.md']
for f in files:
    api.upload_file(
        path_or_fileobj='$DEPLOY_DIR/' + f,
        path_in_repo=f,
        repo_id='$SPACE_REPO',
        repo_type='space',
        commit_message=f'Update {f} - add FastAPI REST endpoints'
    )
    print(f'  ✓ Uploaded {f}')

print('✓ All files uploaded')
"

echo ""
echo "============================================================"
echo "🚀 UPDATE COMPLETE!"
echo "============================================================"
echo ""
echo "Space URL:  https://huggingface.co/spaces/$SPACE_REPO"
echo "API URL:    https://che237-cyberforge.hf.space"
echo ""
echo "⏳ The Space will rebuild (2-5 minutes)."
echo ""
echo "Once running, set your Heroku backend to use it:"
echo "  heroku config:set AI_SERVICE_URL=https://che237-cyberforge.hf.space -a cyberforge-ddd97655464f"
echo ""
echo "Test:"
echo "  curl https://che237-cyberforge.hf.space/health"
echo "  curl -X POST https://che237-cyberforge.hf.space/analyze -H 'Content-Type: application/json' -d '{\"query\":\"Is this safe?\"}'"
echo ""
