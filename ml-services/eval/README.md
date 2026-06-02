# CyberForge ML Eval Harness

A small, **HF-native** evaluation harness for the deployed Hugging Face Space
(`Che237/cyberforge`). It runs against the *live* Space over HTTPS — no local ML,
no model downloads — and is the Phase 0 quality gate for the Gemini → DeepSeek
migration (see `../ML_INFRASTRUCTURE_PLAN.md`).

## What it checks

| kind   | endpoint                  | checks |
|--------|---------------------------|--------|
| health | `GET /health`             | the Space reports `reasoning_llm: deepseek` |
| chat   | `POST /api/v2/security-chat` | which engine answered (deepseek / mistral / ml-fallback), latency, loose keyword presence |
| url    | `POST /api/v2/url-classify` | phishing/malware classification matches the labeled verdict |

## Run

```bash
pip install requests
export SPACE_URL=https://che237-cyberforge.hf.space   # default; override if the subdomain differs
python eval_harness.py                                # uses testset.jsonl
python eval_harness.py --json report.json             # also write a machine-readable report
```

- **No token needed** for a public Space — the Space calls DeepSeek server-side
  with its own `HF_TOKEN` secret. Set `HF_TOKEN` in your env only if the Space is
  private (sent as a Bearer header; never hardcoded here).
- Exit code = number of failing cases (capped), so it can gate CI.

## Reading the result

- `chat engines: deepseek=N` confirms DeepSeek is live. If you instead see
  `mistral=` or `ml-fallback=`, the Space is **falling back** — verify the
  `HF_TOKEN` secret is set on the Space and that `REASONING_LLM_MODEL`
  (default `deepseek-ai/DeepSeek-V3-0324`) is available on HF Inference Providers.
- `latency p50/p95` tracks reasoning responsiveness across the run.

## Extending

Add lines to `testset.jsonl` (one JSON object per line; `#` lines ignored).
`expect` fields are intentionally loose to avoid flaky failures:

```json
{"id": "my-case", "kind": "chat", "input": "...", "expect": {"engine_any": ["deepseek"], "contains_any": ["mitre", "t1059"]}}
{"id": "my-url",  "kind": "url",  "input": "http://...", "expect": {"label": "malicious"}}
```

As the 8 specialized agents land (per the plan), add per-agent endpoints and a
labeled set for each so this harness becomes the regression gate for all of them.
