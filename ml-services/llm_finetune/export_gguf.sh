#!/usr/bin/env bash
# Turn the merged fine-tuned model into the GGUF file the Space loads.
#
#   1. convert   merged safetensors -> BF16 GGUF (llama.cpp convert_hf_to_gguf.py)
#   2. imatrix   importance matrix from CyberForge prompts and answers, so the
#                4-bit rounding keeps precision where this traffic needs it
#   3. quantize  BF16 -> Q4_K_M, the same quantization type the Space serves today
#
# usage: export_gguf.sh <merged_dir> <out_dir> <train.jsonl> [llama.cpp dir]
set -euo pipefail

MERGED=$1
OUT=$2
CALIB_JSONL=$3
LLAMA=${4:-llama.cpp}
NAME=${GGUF_NAME:-cyberforge-qwen3.5-2b}
mkdir -p "$OUT"

if [ ! -x "$LLAMA/build/bin/llama-quantize" ]; then
  [ -d "$LLAMA" ] || git clone --depth 1 https://github.com/ggml-org/llama.cpp "$LLAMA"
  cmake -S "$LLAMA" -B "$LLAMA/build" -DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=OFF
  cmake --build "$LLAMA/build" -j "$(nproc)" --target llama-quantize llama-imatrix
fi
pip install -q "$LLAMA/gguf-py" sentencepiece protobuf

echo "== 1. convert"
# --no-mtp: transformers does not save Qwen3.5's multi-token-prediction head, and
# the llama.cpp in the Space (llama-cpp-python 0.3.36) expects the 24 main blocks only
python "$LLAMA/convert_hf_to_gguf.py" "$MERGED" --no-mtp --outtype bf16 --outfile "$OUT/$NAME-BF16.gguf"

echo "== 2. importance matrix"
# 400 training examples in the served chat format (prompt + answer)
python - "$CALIB_JSONL" "$OUT/calibration.txt" <<'EOF'
import json, random, sys
rows = [json.loads(l) for l in open(sys.argv[1], encoding="utf-8")]
random.Random(1).shuffle(rows)
with open(sys.argv[2], "w", encoding="utf-8") as f:
    for r in rows[:400]:
        s, u, a = (m["content"] for m in r["messages"])
        f.write(f"<|im_start|>system\n{s}<|im_end|>\n<|im_start|>user\n{u}<|im_end|>\n"
                f"<|im_start|>assistant\n<think>\n\n</think>\n\n{a}<|im_end|>\n")
EOF
"$LLAMA/build/bin/llama-imatrix" -m "$OUT/$NAME-BF16.gguf" -f "$OUT/calibration.txt" \
  -o "$OUT/imatrix.gguf" -c 512 --chunks "${IMATRIX_CHUNKS:-200}" -t "$(nproc)"

echo "== 3. quantize"
"$LLAMA/build/bin/llama-quantize" --imatrix "$OUT/imatrix.gguf" "$OUT/$NAME-BF16.gguf" "$OUT/$NAME-Q4_K_M.gguf" Q4_K_M "$(nproc)"
ls -la "$OUT"
