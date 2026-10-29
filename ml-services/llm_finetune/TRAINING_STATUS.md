# Qwen training and release — October 23, 2026

**October 23 release:** V2 refinement/export and the final constrained comparison
completed. The accepted serving pipeline uses reviewed reference retrieval,
constrained passage selection and sentence verification for 13 covered topics.
The final job `6adac192925af0e27d4f9a58` passed all eight unchanged gate checks:
130/130 covered factual/support checks, no reference substitutions and 84/87
(96.55%) regression risk-label agreement. This is constrained source selection,
not a claim of perfect general model knowledge. Earlier rejected reports are
preserved; ordinary generation outside the library can still hallucinate.

Backend release v53 and Space source `f79b9e8cd3c2f0fb98851789ca1124c3ce4ee930`
are deployed. The Space health response confirms the following pinned V2 weights
are loaded, with no load error:
`Che237/cyberforge-qwen3.5-2b-v2-GGUF@494483e9a85362b5d0bd596f9040bbc0848c860a`.
See [V2_RELEASE.md](V2_RELEASE.md) for methods, live integration checks and rollback.

Previous endpoint: commit `f67e46e` added the LoRA pipeline, but the private SFT
bundle/model repositories did not exist and the account had no prior Jobs.
The account now reports PRO. The live Space was RUNNING on cpu-basic when checked.

## Completed

- Created private `Che237/cyberforge-llm-sft` and
  `Che237/cyberforge-qwen3.5-2b-GGUF` repositories.
- Remote CPU data preparation completed successfully:
  [data job](https://huggingface.co/jobs/Che237/6ada7999925af0e27d4f7333).
- Built **5,417 train / 251 validation / 487 test** examples.
- Fixed missing model card, evaluation-script packaging, Windows shell line
  endings, answer token overflow, and revision pinning. Added staged cloud
  launcher, job inspection, private input bundle, checkpoint preservation and
  CUDA GGUF export matched to the serving llama.cpp version.
- Three local regression checks passed; Python compilation and Bash syntax
  checks passed. These do not establish trained-model quality.
- Downloaded and validated all splits: exact prompt uniqueness, role ordering,
  system prompt consistency, populated messages, counts and analyst word limit.
- [L4 GPU smoke job](https://huggingface.co/jobs/Che237/6ada7a68c191903149a75e45)
  completed successfully. Two optimization steps on 16 training / 8 validation
  examples took 43.07 seconds. Small-sample validation loss moved from 2.4937 to
  2.3924; this is a pipeline check, not a quality benchmark. Artifacts uploaded.

## Training and evaluation completed

[Full L4 training/export job](https://huggingface.co/jobs/Che237/6ada7bc2925af0e27d4f74f1)
completed successfully. Two epochs, 678 steps, batch size 2, accumulation 8,
LoRA rank 16, learning rate 0.0001. Validation loss: 2.623355 before and
0.067666 after. Training runtime: 2,334 seconds, excluding export/setup.
The 1.274 GB Q4_K_M GGUF and adapter were uploaded.
Training bundle: `542f1d5e90cbc8a95f69e677431c797139294b79`.
Candidate model revision: `9fcfd481271b09218de9e1bd0c7e7b224c58dd41`.

[Held-out CPU evaluation](https://huggingface.co/jobs/Che237/6ada8174925af0e27d4f7881)
also completed successfully on 240 prompts. Exact reference risk-level agreement
improved from 41.38% to 93.10%. Analyst concision, memory behavior and handling of
unverified indicators improved. Four local regression checks passed, including
failure/timeout handling for the evaluation dependency.

**Original candidate decision: held for factual quality.** Manual review found incorrect
security advice on held-out knowledge questions. See [EVALUATION_REVIEW.md](EVALUATION_REVIEW.md)
for measured results, artifact locations and concrete follow-up. Training and
evaluation are complete; this first artifact was not promoted. The V2 release
described at the top supersedes it.

Base revision: `Qwen/Qwen3.5-2B@15852e8c16360a2fea060d615a32b45270f8a8fc`.
Detailed receipts are in the ignored `runs/` directory. Inspect the latest with
`python job_status.py` after supplying `HF_TOKEN` in the process environment.

## Continuing quality work

1. Broaden and periodically review the primary-source library as product needs grow.
2. Obtain an independent expert factual evaluation; current authored checks are bounded.
3. Improve uncovered generation and investigate the three remaining risk-label
   disagreements before claiming broader quality improvements.

See [README.md](README.md) for phases, commands and compute limits. Credentials
are not stored in this status file or in job receipts.
