#!/usr/bin/env bash
# Runs inside a Hugging Face Job (GPU). launch_hf_job.py starts it; it does
# everything after the dataset is built:
#   download the code + dataset bundle -> LoRA training -> merge -> GGUF export
#   -> upload the GGUF, adapter, reports and model card to the model repository.
# Needs: HF_TOKEN (secret), BUNDLE_REPO, MODEL_REPO; optional TRAIN_ARGS.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq git cmake build-essential > /dev/null

pip install -q "transformers>=5.20" "peft>=0.21" "accelerate>=1.15" "huggingface_hub>=1.0" \
  datasets sentencepiece protobuf "flash-linear-attention" 2>&1 | tail -1
# flash-linear-attention: the Triton kernels for Qwen3.5's Gated-DeltaNet layers
# (without it transformers falls back to a much slower PyTorch loop)

WORK=/tmp/cf && mkdir -p $WORK && cd $WORK
hf download "$BUNDLE_REPO" --repo-type dataset --local-dir bundle
cd bundle/llm_finetune
nvidia-smi --query-gpu=name,memory.total --format=csv

python train_lora.py --data ../data --out $WORK/run ${TRAIN_ARGS:-}
GGUF_NAME=cyberforge-qwen3.5-2b bash export_gguf.sh $WORK/run/merged $WORK/gguf ../data/train.jsonl $WORK/llama.cpp

mkdir -p $WORK/upload
cp $WORK/gguf/cyberforge-qwen3.5-2b-Q4_K_M.gguf $WORK/gguf/imatrix.gguf $WORK/upload/
cp -r $WORK/run/adapter $WORK/upload/adapter
cp $WORK/run/train_report.json $WORK/run/train_log.jsonl ../data/stats.json $WORK/upload/
cp MODEL_CARD.md $WORK/upload/README.md
hf upload "$MODEL_REPO" $WORK/upload . --repo-type model --commit-message "Fine-tuned CyberForge chat model (LoRA SFT, Q4_K_M)"
echo "JOB DONE"
