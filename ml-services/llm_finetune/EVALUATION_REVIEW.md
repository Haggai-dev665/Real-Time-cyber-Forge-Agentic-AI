# Qwen candidate review

Reviewed October 23, 2026 UTC. **Decision: hold deployment for factual quality.**

Training and export completed successfully in
[the L4 job](https://huggingface.co/jobs/Che237/6ada7bc2925af0e27d4f74f1).
Two epochs over 5,417 training examples took 2,334 seconds for training itself;
validation loss fell from 2.623355 to 0.067666. Low loss on these templated,
rule-authored targets is not a measure of independent security accuracy.

The candidate is private at `Che237/cyberforge-qwen3.5-2b-GGUF`, revision
`9fcfd481271b09218de9e1bd0c7e7b224c58dd41`. The Q4_K_M GGUF is
1,274,396,416 bytes. The adapter, training report and environment were uploaded.

[CPU evaluation](https://huggingface.co/jobs/Che237/6ada8174925af0e27d4f7881)
also completed, comparing 240 identical held-out prompts with fixed per-example
seeds and llama-cpp-python 0.3.36. Reports and actual responses are under
`evaluation/9fcfd481271b09218de9e1bd0c7e7b224c58dd41/` in the model repository.

| Measurement | Base | Candidate |
| --- | ---: | ---: |
| Exact agreement with reference risk level (applicable subset) | 41.38% | 93.10% |
| Correct risk-line presence/absence | 98.33% | 99.58% |
| Analyst answers within 80 words | 96.15% | 100% |
| Memory recall (applicable subset) | 97.83% | 100% |
| Invented memory hosts (applicable subset) | 4.55% | 0% |
| Unverified indicator acknowledged (applicable subset) | 41.18% | 100% |
| Raw unsupported-number flag rate | 0.83% | 3.75% |
| Mean generation seconds on evaluation CPU | 5.1441 | 3.4935 |

The risk metric measures agreement with the builder's reference rules, not
verified threat detection. Latency was measured on the evaluation worker,
not the serving Space. Metric denominators vary by applicable task; 240 is
the total sample count, not the denominator of every metric.

## Manual findings

- Eight of the nine candidate numeric flags mention the fixed `0.50` detector
  decision line, which the input omitted. These are evaluator/context mismatches,
  not evidence of nine fabricated detector scores. Keep the raw results; add
  the decision policy to future prompts before rescoring new runs.
- The remaining flagged answer (`cf-03504`, Heartbleed) invents an incorrect
  affected OpenSSL version. The actual affected range is documented by
  [OpenSSL](https://www.openssl-library.org/news/vulnerabilities-1.0.1/index.html).
- `cf-04136` recommends disabling cookie-consent banners to prevent CSRF.
  That recommendation conflicts with the controls in the
  [OWASP CSRF prevention guide](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- `cf-05535`, `cf-05726` and `cf-06063` fail to explain push bombing/MFA fatigue
  correctly. Compare [MITRE ATT&CK T1621](https://attack.mitre.org/techniques/T1621/).
- Some URL answers say all detectors are below the threshold while ignoring
  an anomaly score above it. The target generator often bases its verdict on
  supervised detectors only; its explanations need to name that distinction.
- The baseline also has factual errors. Improved aggregate scores do not
  remove the need to review security advice before promotion.

## Follow-up before release

1. Improve target wording and include explicit threshold policy in context.
2. Add independently sourced knowledge coverage and retrieval for factual advice;
   avoid simply teaching the held-out test questions and claiming the same test
   remains independent. Preserve this run and use a fresh factual test set.
3. Review response-level grounding and dangerous advice alongside risk metrics.
4. Re-evaluate a corrected candidate before configuring the live Space.

The current candidate has not been promoted. No new GPU training job was launched
as part of this status review.
