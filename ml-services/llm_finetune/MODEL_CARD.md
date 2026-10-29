---
base_model: Qwen/Qwen3.5-2B
library_name: peft
pipeline_tag: text-generation
tags:
- lora
- cybersecurity
- gguf
---

# CyberForge Qwen3.5-2B V2

LoRA supervised fine-tuning for CyberForge's analyst and assistant chat routes.
Text-only training freezes the vision tower and learns answers in the exact
non-thinking prompt format used by the deployed Space.

Training examples combine public URL datasets scored by the deployed detectors,
owner-provided security records, and authored explanations. Targets are generated
from rules and supplied evidence; they are not independent expert verdicts.
Source attribution is in each example and the dataset statistics/provenance.
Upstream data licenses still apply; this private candidate is not a claim of
permission to redistribute source datasets.

## Artifact and training

Accepted weight artifact: `494483e9a85362b5d0bd596f9040bbc0848c860a` in
`Che237/cyberforge-qwen3.5-2b-v2-GGUF`.
File: `cyberforge-qwen3.5-2b-Q4_K_M.gguf`.
The private repository also contains the PEFT adapter and training report.

Base: `Qwen/Qwen3.5-2B@15852e8c16360a2fea060d615a32b45270f8a8fc`.
Initialization: previous CyberForge adapter at
`9fcfd481271b09218de9e1bd0c7e7b224c58dd41`.
V2 uses 2,462 training and 273 validation examples: corrected task-balanced replay
and reviewed primary-reference instructions. The 487-item legacy test split is
retained for regression; it is not a new independent benchmark.

Supervised answer-token LoRA: rank 16, alpha 32, dropout 0.05, learning rate
0.00002, batch 2, accumulation 8, 100 steps, NVIDIA L4. Training runtime was
412.67 seconds; validation loss changed from 0.136654 to 0.066537. Loss measures
adaptation to these targets, not factual accuracy. No RL or online training is
used. Merged weights were exported and importance-quantized to Q4_K_M with the
llama.cpp revision matched to `llama-cpp-python==0.3.36`.

## Acceptance applies to the serving pipeline

**The weights alone were not accepted as a reliable factual security assistant.**
Manual review found unsupported mechanisms and remedies even after an initial
keyword-based gate passed. A stricter sentence-check evaluation required reference
replacement on 56/130 covered answers (43.08%), failing the fixed 25% ceiling.
Those rejected results remain under `release/` and `release-grounded/`.

The accepted pipeline combines V2 with the shared CyberForge reference library,
current-question retrieval, GBNF-constrained selection of reviewed passages and
a whole-sentence support check. Policy revision: `2026-10-23.3`. Thirteen topics
have reviewed primary sources from OWASP, MITRE, NIST, OpenSSL and USPIS.
Responses carry citations and `grounding.generation_constraint: reviewed_passages`.
An incomplete or unsupported answer is explicitly labelled as a reference
substitution. Uncovered requests continue ordinary model generation.

This is bounded extractive generation. The model chooses full or concise source
passages; it does not freely compose factual claims for covered topics. Retrieval,
grammar and reference checks are inference controls, not additional weight updates.
Use the exact repository serving code and policy to reproduce this behavior.

## Measured comparison

Final report:
`release-constrained/494483e9a85362b5d0bd596f9040bbc0848c860a/release_report.json`.
Source bundle: `Che237/cyberforge-llm-sft-v2@ca4729eabf8b1bd02e17e413b7db00b751bcbb85`.
CPU Job: https://huggingface.co/jobs/Che237/6adac192925af0e27d4f9a58.

Both previous and V2 models with the current reference constraint passed all
130 covered factual/support checks, with correct retrieval and zero reference
substitutions. This reflects constrained source selection, **not unaided recall**.
The set includes 78 pre-training-frozen scenario/mode cases and 52 additional
author-reviewed cases created after manual review. Neither is an independent
expert security audit. None of those exact scenario prompts entered V2 SFT.

On 240 legacy regression items per model, risk-label agreement was 83/87 (95.40%)
for the previous adapter and 84/87 (96.55%) for V2. Applicable analyst cases all
fit 80 words; there were no invented remembered hosts in the applicable memory
cases. Three V2 risk labels still disagree with their authored targets.
Unchanged regression outputs were reused only for the same immutable weights,
seed and complete prompt, without reference decoding; 26 changed inputs per
model were generated again. Timings mix those runs and are not a new benchmark.

## Limits and use

The small reviewed library does not cover arbitrary questions, new CVEs, live
reputation or incident investigation. Matching a topic does not prove that the
selected passage fully answers every requested detail. Sources require periodic
review. Uncovered generation can still hallucinate or suggest an unsuitable
control; the regression set includes an XSS explanation that incorrectly
recommends parameterisation. Do not treat language-model output as detector
evidence, calibrated confidence, permission to act, or proof of a scan.

The Space loads the artifact by immutable revision. Uploading a card or new
checkpoint never automatically promotes weights. `checkpoints/` and `smoke/`
contain intermediate artifacts. See the project `V2_RELEASE.md` for live checks
and rollback settings.
