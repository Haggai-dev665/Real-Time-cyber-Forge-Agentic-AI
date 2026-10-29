# CyberForge Qwen fine-tuning

The model family is `Qwen/Qwen3.5-2B`, served as a Q4_K_M GGUF by
`hf_space_deploy/app.py`. See [V2 release status](V2_RELEASE.md) for the accepted
repository and immutable revision. Fine-tuning produces a **candidate**;
an upload does not switch the live Space.

## Cloud workflow

Install `huggingface_hub==2.2.0` locally. Supply `HF_TOKEN` through your process
environment or a secret manager. Do not place credentials in source or commands
committed to Git. PRO is verified separately from having compute credits.

Run from this directory, waiting for each job to succeed:

```text
python cloud_job.py --stage data
python cloud_job.py --stage smoke
python cloud_job.py --stage train
python cloud_job.py --stage evaluate --after-job <training-job-id>
```

Data runs on CPU-upgrade with a one-hour timeout; smoke runs on an L4 with a
30-minute timeout; training/export runs on an L4 with a three-hour timeout.
Evaluation runs on CPU-upgrade with a three-hour timeout, waits up to 90 minutes
for its training dependency and saves actual answers plus reports to the private
model repository. Failed training stops evaluation.

At the October 22, 2026 published rates these ceilings are approximately $0.03,
$0.40 and $2.40 respectively; evaluation is capped at approximately $0.09. They are limits, not predictions of runtime or
quality. Jobs can require purchased credits even with PRO. Current prices:
https://huggingface.co/docs/hub/en/jobs-pricing

`runs/latest_job.json` and per-job receipts contain IDs, links, source revisions
and hardware, never tokens. The input dataset and output model repositories are
private. Code is uploaded using an explicit source-file allowlist; local caches,
environment files and checkpoints are excluded. Jobs download immutable bundle
and base-model revisions. Credentials are sent through HF Jobs secrets.

## Learning and training phases

1. **Dataset preparation:** a CPU Job downloads the eight owner record files
   actually used by the builder. Public URL datasets are sampled through the
   detector training loaders. The four deployed detectors supply scores shown
   in each prompt. Answers are rule-authored from that visible evidence, plus
   authored security knowledge and conversational examples. These targets are
   not independently verified human security judgments.
2. **Splitting:** URLs are separated by registered domain. Selected knowledge
   topics are held out entirely; other records use deterministic prompt hashes.
   Similar record templates can occur across splits, so loss alone is not an
   independent measure of real-world security accuracy.
3. **Supervised adaptation:** LoRA learns low-rank updates to language-model
   attention and MLP projections. Vision weights and embeddings stay frozen.
   Only answer tokens contribute to loss; input tokens are masked. This is
   supervised fine-tuning, not reinforcement learning or online learning.
4. **Validation:** the two-step smoke job checks GPU training, evaluation and
   adapter saving. Full training evaluates validation loss periodically and
   keeps the best checkpoint. Reports record before/after loss and settings.
5. **Export:** adapter weights merge into the pinned base, then convert to BF16
   GGUF. Calibration uses training examples only. Importance-aware Q4_K_M
   quantization uses the exact llama.cpp revision bundled with the Space's
   `llama-cpp-python==0.3.36`. CUDA build settings currently target L4 (SM89).
6. **Evaluation and release:** compare base and candidate using `evaluate.py`
   on held-out examples. Review risk formatting, under/over-alarm, grounding,
   memory behavior, concision and retained knowledge. Review actual answers,
   not just overlap scores. Only then change `LOCAL_LLM_REPO` and
   `LOCAL_LLM_FILE` and `LOCAL_LLM_REVISION` in the Space and verify `/health` and
   both chat routes. A private model repository also needs the Space's `HF_TOKEN`
   secret, supplied through the operator API rather than committed files.

Smoke artifacts live under `smoke/`; recoverable run artifacts under
`checkpoints/<stage>/`. Each full-run checkpoint also uploads to `recovery/train`
every 50 optimization steps, including optimizer state. Download that folder and
use `train_lora.py --resume <local checkpoint directory>` to resume in a compatible
environment. An EXIT trap additionally attempts to preserve progress on normal
errors; work since the latest uploaded checkpoint can be lost after a hard kill.
Root GGUF and model-card uploads occur only after full training and export.
The previous `launch_hf_job.py` entry point delegates to this cloud workflow.

## Evaluation command

Download the private dataset and candidate, then use the same CPU runtime as
the serving Space (`llama-cpp-python==0.3.36`):

```text
python evaluate.py --data data/test.jsonl --model base=unsloth/Qwen3.5-2B-GGUF:Qwen3.5-2B-Q4_K_M.gguf --model tuned=Che237/cyberforge-qwen3.5-2b-GGUF:cyberforge-qwen3.5-2b-Q4_K_M.gguf --limit 240 --out eval-comparison
```

Training and inference are distinct: this workflow adapts chat behavior; it
does not retrain the four URL detectors or change their measured accuracy.

## Targeted V2 release comparison

`build_refinement.py` builds task-balanced replay and reviewed-reference examples.
`refine` continues an existing adapter; the report records the exact initialization.
`release` is the original scenario comparison; `groundcheck` retains the stricter
sentence-check experiment. `constrained` evaluates the current extractive decoding
policy and saves a separate report so rejected experiments remain inspectable:

```text
python cloud_job.py --stage constrained --bundle-repo Che237/cyberforge-llm-sft-v2 --model-repo Che237/cyberforge-qwen3.5-2b-v2-GGUF --candidate-revision 494483e9a85362b5d0bd596f9040bbc0848c860a
```

All three comparison stages use CPU-upgrade; the last two have a two-hour cap.
The 13-topic library, retrieval, prompt and decoding grammar are shared with the
Space. This uses reviewed primary-source summaries, not live web retrieval.
Covered answers select reviewed passages; other requests use ordinary Qwen
generation. Retrieval and grammar constraints are inference controls, not further
training. The fixed gate and manual answer review must both pass before promotion.
