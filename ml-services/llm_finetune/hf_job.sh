#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export PYTHONUNBUFFERED=1
WORK=${CF_WORK_DIR:-/tmp/cf}
mkdir -p "$WORK"
cd "$WORK"
hf download "$BUNDLE_REPO" --revision "$BUNDLE_REVISION" --repo-type dataset --local-dir bundle
cd bundle/llm_finetune
if [ "${STAGE:-train}" = data ]; then
  pip install -q scikit-learn==1.8.0 'pandas>=2.2,<3' 'numpy>=2,<3' joblib tldextract pyarrow
  python prepare_cloud_data.py
  exit 0
fi
if [ "${STAGE:-train}" = evaluate ] || [ "${STAGE:-train}" = release ] || [ "${STAGE:-train}" = groundcheck ] || [ "${STAGE:-train}" = constrained ]; then
  apt-get update -qq && apt-get install -y -qq libgomp1 > /dev/null
  pip install -q --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu --only-binary=llama-cpp-python llama-cpp-python==0.3.36
  python cloud_evaluate.py
  exit 0
fi
apt-get update -qq && apt-get install -y -qq git cmake build-essential > /dev/null
pip install -q transformers==5.20.2 peft==0.21.2 accelerate==1.15.0 sentencepiece protobuf flash-linear-attention==0.5.2
pip freeze > "$WORK/environment.txt"
nvidia-smi --query-gpu=name,memory.total --format=csv
# Save checkpoints on job failure as well as success; never upload credentials.
save_progress() {
  if [ -d "$WORK/run" ]; then
    hf upload "$MODEL_REPO" "$WORK/run" "checkpoints/${STAGE:-train}" --exclude 'merged/*' --commit-message "Preserve training progress" || true
  fi
}
trap save_progress EXIT
if [ "${STAGE:-train}" = smoke ]; then
  python train_lora.py --data ../data --out "$WORK/run" --batch 1 --accum 1 --max-steps 2 --eval-steps 1 --limit 16 --no-merge
  hf upload "$MODEL_REPO" "$WORK/run" smoke --commit-message "Two-step GPU smoke test"
  echo 'SMOKE JOB DONE'
  exit 0
fi
python train_lora.py --data ../data --out "$WORK/run" --batch 2 --accum 8 ${TRAIN_ARGS:-}
save_progress
GGUF_NAME=cyberforge-qwen3.5-2b bash export_gguf.sh "$WORK/run/merged" "$WORK/gguf" ../data/train.jsonl "$WORK/llama.cpp"
mkdir -p "$WORK/upload"
cp "$WORK/gguf/cyberforge-qwen3.5-2b-Q4_K_M.gguf" "$WORK/gguf/imatrix.gguf" "$WORK/upload/"
cp -r "$WORK/run/adapter" "$WORK/upload/adapter"
cp "$WORK/run/train_report.json" "$WORK/run/train_log.jsonl" ../data/stats.json "$WORK/environment.txt" "$WORK/upload/"
cp MODEL_CARD.md "$WORK/upload/README.md"
hf upload "$MODEL_REPO" "$WORK/upload" . --commit-message "CyberForge candidate: LoRA SFT and Q4_K_M, pending evaluation"
echo 'TRAIN JOB DONE: candidate requires held-out evaluation before deployment'
