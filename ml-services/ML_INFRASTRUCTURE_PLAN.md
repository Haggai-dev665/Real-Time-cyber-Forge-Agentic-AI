# CyberForge — ML Infrastructure Enhancement Plan (Hugging Face)

> **Status:** Design document. **No training or deployment has been performed yet** — this is the plan to review/approve before work begins.
> **Scope:** Everything runs on Hugging Face (datasets downloaded/processed on HF, training on HF compute, serving on HF). Nothing ML runs locally.
> **Date:** 2026-05-30

---

## 0. Executive summary

Today the ML layer is a single FastAPI/Docker Space (`Che237/cyberforge` v2.0.0) serving **4 classic tabular classifiers + 1 URL BERT**, with a **Gemini → Mistral-7B** fallback for natural-language explanation/chat. It is healthy but shallow relative to the goal of **8 specialized, trained security agents + a PDF reporting agent**, and it is not HF-dataset-native (data is pulled from GitHub raw CSVs).

This plan delivers:

1. A **9-agent architecture** (8 task agents + 1 reporting agent) with, for each, a concrete HF model, HF dataset(s), training method, eval metrics, and serving target.
2. **DeepSeek (via HF Inference Providers)** as the single reasoning/assistance engine, fully replacing Gemini.
3. A **100%-on-HF workflow**: datasets acquired/processed on HF and pushed to `Che237/cyberforge-datasets`; training via **HF AutoTrain + HF Jobs (PEFT/LoRA, TRL)**; serving via the **Space + HF Inference Endpoints + Inference Providers**.
4. A **phased roadmap** with resourcing, cost, and monitoring.

**Do this first (Phase 0 hygiene):** rotate the leaked HF token; remove the committed Gemini key; resolve the unresolved git merge conflict in `datasets/metadata.json`; move all secrets to HF Space **Secrets** (never in code).

---

## 1. Current-state review (verified 2026-05-30)

### 1.1 What's deployed

| Component | Detail |
|---|---|
| **Space** | `Che237/cyberforge` — Docker SDK, `python app.py` (entry = `hf_space_deploy/app.py`), Python 3.11, port 7860, **cpu-basic**, RUNNING, v2.0.0 |
| **Models repo** | `Che237/cyberforge-models` (119 downloads) — sklearn `.pkl` (joblib) + the BERT |
| **Datasets repo** | `Che237/cyberforge-datasets` (last updated 2026-01-31) |
| **Other spaces** | `Che237/Salesforce-blip-vqa-base` (gradio, unrelated/experimental) |
| **Classic models loaded** | `phishing_detection`, `malware_detection`, `anomaly_detection`, `web_attack_detection` (RandomForest / GradientBoosting / LogisticRegression / IsolationForest on tabular features) |
| **Transformer loaded** | `url_phishing_bert` (`elftsdmr/malware-url-detect`) |
| **LLM / reasoning** | `gemini=false` at runtime → falls back to **`mistralai/Mistral-7B-Instruct-v0.3`** via HF Inference API (`/api/v2/security-chat`, `/api/v2/chat`) |
| **Live endpoints** | `/health`, `/models`, `/analyze`, `/analyze-url`, `/scan-threats`, `/api/v2/batch-analyze`, `/api/v2/explain/{model}`, `/api/v2/ioc-scan`, `/api/v2/url-enrich`, `/api/v2/url-classify`, `/api/v2/dga-detect`, `/api/v2/chat`, `/api/v2/security-chat`, `/api/v2/status` |
| **Training pipeline** | Notebooks `00–07` (env → data acquisition → feature engineering → model training → "agent intelligence" → validation → backend integration → deployment artifacts) |
| **Backend consumer** | Heroku `backend` calls the Space via `services/mlServiceClient.js`; desktop reaches ML through Heroku proxy `/api/cyberforge-ml`. The 8-agent UI exists in the desktop + `backend/src/routes/orchestrator.js`, but is **not backed by 8 trained models**. |

### 1.2 Capabilities (what works well)
- A real, always-on inference service with clean REST + a Gradio UI; OpenAI-style explanation via HF Inference.
- Sensible classic detectors for phishing/malware/anomaly/web-attack with explainability (`/api/v2/explain`).
- IOC + DGA + URL-enrich endpoints already used by the desktop scan pipeline.

### 1.3 Limitations / risks (what to fix)
1. **Not "8 agents."** It's 4 tabular detectors + 1 BERT + 1 generic LLM chat. No dedicated **vulnerability assessment, deep malware analysis, incident response, log analysis, compliance/audit, remediation, or reporting** agents.
2. **Gemini is a dead dependency** — disabled at runtime, key returns `PERMISSION_DENIED`, and (per repo memory) the key is exposed in git. Must be replaced + removed.
3. **Datasets are not HF-native** — `datasets/metadata.json` points at **GitHub raw CSVs** (NSL-KDD, ad-hoc malware CSVs). Violates the "everything on HF" requirement and is fragile (dead links, no versioning/licensing).
4. **cpu-basic** Space: cold-starts/sleeps, slow for transformers, can't host larger models → user-visible latency and no GPU headroom.
5. **No evaluation harness / model cards / drift monitoring** — no tracked metrics, no held-out benchmarks, no retraining cadence.
6. **Repo hygiene:** unresolved git merge conflict markers in `datasets/metadata.json` (`<<<<<<< Updated upstream`); many `fix_*.py` one-off scripts; secrets in code.
7. **Classic models are tabular-feature dependent** — the desktop scan sends scraped/URL features; feature drift between training data and live scraper output is unverified (no live calibration).

### 1.4 Performance posture
- No published metrics. **First task of Phase 1 is to build the eval harness** and baseline each existing model on a held-out HF test split, so every later change is measured against a number — not vibes.

---

## 2. Target architecture — the 9-agent system

```
                         ┌─────────────────────────────────────────────┐
 Desktop / Backend  ──▶  │   Orchestrator (backend/orchestrator.js)     │
 (scan, audit, IR)       │   routes a task to one/many agents, fuses    │
                         └───────────────┬─────────────────────────────┘
                                         │  REST (HF Space) + Inference Providers
        ┌────────────────────────────────┼───────────────────────────────────────┐
        ▼              ▼                  ▼                ▼               ▼        ▼
  [1 Threat Det.] [2 Vuln Assess.] [3 Malware] [4 Sec. Monitor] [5 Incident Resp.] …
        │  fast classifiers (Space)   │ RAG+LLM      │ EMBER GBT     │ IDS models    │ DeepSeek-R1
        ▼                             ▼              ▼               ▼               ▼
  [6 Log Analysis] [7 Compliance/Audit] [8 Recommendation/Remediation] [9 Reporting → PDF]
        │ LogBERT/templates  │ RAG over CIS/NIST   │ RAG + DeepSeek          │ DeepSeek + WeasyPrint
        └───────────────────────────────┬───────────────────────────────────────┘
                                         ▼
                  Shared services:  DeepSeek-V3.2/R1 (HF Inference Providers, reasoning)
                                    Embeddings + Vector memory (RAG; reuse the desktop's
                                    local-first store + backend /api/memory)
```

**Design principles**
- **Two tiers per agent where useful:** a *fast deterministic model* (classifier) for the verdict + a *reasoning layer* (DeepSeek) for explanation/recommendation. The desktop already expects this split.
- **One reasoning engine** (DeepSeek) shared by the language agents — not nine fine-tunes. Specialization comes from **prompts + retrieval (RAG) + small task LoRAs**, which is far cheaper to train and maintain than nine full models.
- **RAG over fine-tuning** wherever knowledge is factual and changes often (CVEs, compliance controls, playbooks) — fine-tune only where behavior/format must be learned.
- **Reuse the vector memory** already built (local-first store + `/api/memory`) as the retrieval substrate so past scans inform every agent.

---

## 3. Per-agent specifications

> Legend — **Serve**: `Space` = the Docker Space (small models), `Endpoint` = HF Inference Endpoint (dedicated, scale-to-zero), `Provider` = HF Inference Providers (serverless DeepSeek). Dataset IDs marked **(verify)** are strong candidates found via search/knowledge — confirm exact id/license on the HF Hub before use.

### Agent 1 — Threat Detection & Analysis
- **Job:** classify URLs/pages/IOCs as benign/suspicious/malicious + category; feed the desktop scan + Threat Globe.
- **Model:** fine-tune `microsoft/deberta-v3-base` (or keep `distilbert` for speed) for URL/page classification; keep ensembling with the tabular phishing model.
- **Datasets (HF):** `imanoop7/phishing_url_classification` (verify), `ealvaradob/phishing-dataset` (verify), `pirocheto/phishing-url` (verify), `elftsdmr/malware-url-detect` (current).
- **Training:** HF **AutoTrain** (text-classification) or `Trainer`; class-weighting for imbalance.
- **Metrics:** F1, ROC-AUC, **precision @ ≤1% FPR** (security-critical), PR-AUC, confusion by category.
- **Serve:** Space (distilbert) or Endpoint (deberta).

### Agent 2 — Vulnerability Assessment
- **Job:** given software/CPE/CVE/finding, return affected CVEs, CVSS, exploitability, and prioritized risk.
- **Model:** **RAG-first** — embed a CVE/CWE/exploit corpus into a vector index; DeepSeek reasons over retrieved records. Optional LoRA on `Qwen2.5-7B-Instruct` or `DeepSeek-R1-Distill-Qwen-7B` for CVE Q&A formatting.
- **Datasets (HF):** `stasvinokur/cve-and-cwe-dataset-1999-2025`, `AlicanKiraz0/All-CVE-Records-Training-Dataset` (~300k, conversational), `Bouquets/Cybersecurity-LLM-CVE`, `darkknight25/Exploit_Database_Dataset` (Exploit-DB + CISA KEV).
- **Training:** build embeddings (e.g., `BAAI/bge-small-en-v1.5`) on HF Jobs → push index; optional LoRA via TRL `SFTTrainer`.
- **Metrics:** retrieval **recall@k / MRR**, CVSS **MAE**, citation correctness, hallucination rate (must cite a real CVE id).
- **Serve:** embeddings on Space/Endpoint; reasoning via Provider.

### Agent 3 — Malware Analysis
- **Job:** static verdict + family + explanation for files/hashes/PE features (Sandbox screen).
- **Model:** **LightGBM/XGBoost** on **EMBER** features (the EMBER baseline; ~900k train/200k test PE files) for the verdict; DeepSeek for the human explanation over extracted strings/imports.
- **Datasets (HF):** EMBER (mirror on HF — **verify** the canonical HF copy, e.g., search `ember` malware PE), plus the URL/malware datasets from Agent 1 for URL-borne malware.
- **Training:** HF **Jobs** GPU/CPU job — LightGBM on EMBER vectors; calibrate threshold to a target FPR.
- **Metrics:** ROC-AUC, **detection rate @ 0.1% FPR** (the EMBER standard), family macro-F1.
- **Serve:** Space (LightGBM is light) + Provider for explanation.

### Agent 4 — Security Monitoring (network/anomaly)
- **Job:** flag anomalous network/system telemetry; back the desktop's live telemetry + node health.
- **Model:** XGBoost (multi-class attack) + IsolationForest (unsupervised anomaly) — upgrade the current `anomaly_detection`/`web_attack_detection`.
- **Datasets (HF):** NSL-KDD, **CICIDS2017**, **UNSW-NB15** (HF mirrors — **verify**; replace the GitHub-raw NSL-KDD currently used).
- **Training:** HF **AutoTrain** (tabular-classification) + a Jobs run for IsolationForest.
- **Metrics:** per-class F1, macro-F1, detection rate, **FPR** (ops-critical), PR-AUC.
- **Serve:** Space.

### Agent 5 — Incident Response Assistant
- **Job:** given an alert/incident, produce triage steps, containment/eradication actions, and an action plan; align to MITRE ATT&CK.
- **Model:** **DeepSeek-R1** (deep reasoning) grounded via RAG on playbooks + MITRE ATT&CK + the vector memory of past incidents. Optional LoRA on IR instruction data for house style.
- **Datasets (HF):** `AlicanKiraz0/Cybersecurity-Dataset-v1` (verify) + a curated MITRE ATT&CK / playbook set (build + push to `Che237/cyberforge-datasets`).
- **Training:** mostly **prompt + RAG**; optional LoRA via TRL.
- **Metrics:** playbook-step accuracy vs. gold runbooks, MITRE technique mapping accuracy, human-rated usefulness (rubric).
- **Serve:** Provider (R1).

### Agent 6 — Log Analysis
- **Job:** parse/templatize logs, detect anomalous sequences, summarize incidents from logs.
- **Model:** template mining (Drain) + a **LogBERT-style** sequence anomaly model; DeepSeek for summarization.
- **Datasets (HF):** **LogHub** (HDFS, BGL, Thunderbird) — mirror to HF (**verify**/upload).
- **Training:** HF **Jobs** (sequence model); unsupervised + a small labeled eval.
- **Metrics:** anomaly **F1**, precision/recall on known incident windows, parsing accuracy.
- **Serve:** Endpoint (sequence model) + Provider (summary).

### Agent 7 — Compliance & Security Auditing
- **Job:** map findings/config to control frameworks (CIS, NIST 800-53, ISO 27001, SOC 2, PCI-DSS); produce audit results + gaps.
- **Model:** **RAG-only** (DeepSeek) over a controls knowledge base — almost no training, because controls are reference text that must be cited verbatim.
- **Datasets (HF):** build a controls corpus (CIS Benchmarks/NIST OSCAL where licensing permits) → push to HF; general security instruction data for style.
- **Training:** none (RAG); embeddings only.
- **Metrics:** control-mapping accuracy, citation correctness, coverage of required controls per framework.
- **Serve:** Provider + embeddings Endpoint.

### Agent 8 — Security Recommendations & Remediation
- **Job:** turn findings (from agents 1–7) into prioritized, actionable remediation steps with effort/impact and CWE/MITRE mapping.
- **Model:** **DeepSeek-V3.2** with RAG over remediation knowledge + the finding context; few-shot templates for consistent output schema.
- **Datasets (HF):** remediation/hardening guidance corpus (build) + CWE mitigations (from Agent 2 corpus).
- **Training:** prompt + few-shot; optional small LoRA for output-schema adherence.
- **Metrics:** actionability (rubric), correctness of CWE/MITRE mapping, schema-validity rate.
- **Serve:** Provider.

### Agent 9 — Reporting Agent (professional PDF)
- **Job:** compose a branded PDF: executive summary, security findings, risk assessment, vulnerability summary, audit results, recommendations + remediation.
- **Model:** **DeepSeek** for narrative generation from a **structured report schema** (JSON assembled from agents 1–8) + a deterministic **PDF renderer** (WeasyPrint HTML→PDF, or ReportLab) running on the Space.
- **Datasets:** none (template + schema-driven). Keep a few gold reports for few-shot + eval.
- **New endpoint:** `POST /api/v2/report` → returns `application/pdf` (and stores it). Backend proxies; desktop "Reports" screen downloads it.
- **Metrics:** schema completeness, factual consistency vs. inputs (no invented findings), render-correctness, human review.
- **Serve:** Space (rendering) + Provider (narrative).

---

## 4. DeepSeek reasoning engine (replaces Gemini)

**Model choice**
- **`deepseek-ai/DeepSeek-V3.2`** — default assistant/explanation/recommendation/compliance/reporting (fast, cheap, strong general reasoning).
- **`deepseek-ai/DeepSeek-R1`** — deep reasoning agents (incident response, complex vuln triage).
- **Self-host fallback (optional, GPU):** `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` on an Inference Endpoint if you want no per-token cost / full data control.

**Access** — HF **Inference Providers** (serverless), OpenAI-compatible router `https://router.huggingface.co/v1`, or `huggingface_hub.InferenceClient(provider="auto")`. The Space already uses `InferenceClient` for Mistral — this is a **drop-in swap**.

**Integration changes (concrete):**
- `ml-services/hf_space_deploy/app.py`:
  - Remove **"Path 1: Gemini"** (~line 1678) and the `genai.Client` init (~line 121–125).
  - Replace `SECURITY_LLM_REPO` default (`mistralai/Mistral-7B-Instruct-v0.3`, ~line 591) with `deepseek-ai/DeepSeek-V3.2`; add `REASONING_LLM = deepseek-ai/DeepSeek-R1` for the reasoning agents.
  - Route all `/api/v2/chat`, `/security-chat`, explanation/recommendation calls through one `llm()` helper using `InferenceClient(...).chat.completions.create(...)`.
- `ml-services/app/services/gemini_service.py` → rename/replace with `deepseek_service.py` (same interface; `genai` calls → `InferenceClient`). Delete `google-genai` from `requirements.txt`.
- `backend/src/services/mlServiceClient.js` → the Gemini "Path 1" / `getExplanation` should call the Space's DeepSeek-backed endpoint; drop direct Gemini.
- **Secret:** add `HF_TOKEN` to Space **Secrets** (already needed for Inference Providers); remove `GEMINI_API_KEY` everywhere.
- **Prompt grounding:** every language agent gets a system prompt + retrieved context (RAG) + the scan/finding JSON; enforce **citations** and a **JSON output schema** (so the reporting agent can consume it).

**Why this is the right call:** zero hosting cost for the 671B model (serverless), removes the broken Gemini dependency and its exposed key, and keeps a clean self-host path if you later need on-prem/no-egress.

---

## 5. Datasets — HF-native acquisition (per the "everything on HF" rule)

All acquisition/cleaning runs **on HF** (an HF **Job** or a utility Space using the `datasets` library), and the processed splits are pushed to **`Che237/cyberforge-datasets`** with a dataset card (source, license, schema, split sizes). **Nothing is downloaded to the user's machine.**

| Agent | Primary HF dataset(s) | Notes |
|---|---|---|
| 1 Threat | `imanoop7/phishing_url_classification`, `ealvaradob/phishing-dataset`, `pirocheto/phishing-url`, `elftsdmr/malware-url-detect` | dedupe + canonical label map |
| 2 Vuln | `stasvinokur/cve-and-cwe-dataset-1999-2025`, `AlicanKiraz0/All-CVE-Records-Training-Dataset`, `Bouquets/Cybersecurity-LLM-CVE`, `darkknight25/Exploit_Database_Dataset` | RAG corpus + eval QAs |
| 3 Malware | EMBER (HF mirror — verify) | static PE features |
| 4 Monitoring | NSL-KDD / CICIDS2017 / UNSW-NB15 (HF mirrors — verify) | replace GitHub-raw NSL-KDD |
| 5 Incident | `AlicanKiraz0/Cybersecurity-Dataset-v1` + MITRE ATT&CK (build) | instruction/playbook |
| 6 Logs | LogHub HDFS/BGL/Thunderbird (mirror to HF) | anomaly + parsing |
| 7 Compliance | CIS/NIST/ISO/SOC2 controls corpus (build, license-checked) | reference text for RAG |
| 8 Remediation | CWE mitigations + hardening guides (build) | from Agent 2 corpus |
| 9 Reporting | gold report templates (build) | few-shot + eval only |

**Acquisition script pattern (runs on HF):**
```python
# pushed as an HF Job; HF_TOKEN from Space/Job secret — NEVER hardcoded
from datasets import load_dataset
ds = load_dataset("imanoop7/phishing_url_classification")          # downloads on HF infra
ds = ds.map(clean_and_label)                                       # normalize schema
ds.push_to_hub("Che237/cyberforge-datasets", config_name="threat_urls")
```

---

## 6. Training strategy (all on HF compute)

| Agent | Method | HF tool |
|---|---|---|
| 1 Threat (text) | fine-tune DeBERTa/DistilBERT (text-classification) | **AutoTrain** or `Trainer` on a **Job** |
| 1/4 (tabular) | RandomForest/XGBoost; class-weight; threshold calibration | **AutoTrain (tabular)** / Job |
| 3 Malware | LightGBM on EMBER; FPR-calibrated | **Job** (CPU/GPU) |
| 4 Monitoring | XGBoost + IsolationForest | AutoTrain + Job |
| 6 Logs | Drain templates + LogBERT-style model | **Job** (GPU) |
| 2/5/8 (LLM specialization) | **PEFT/LoRA** via **TRL `SFTTrainer`** on DeepSeek-distill/Qwen | **Job** (A10G/A100) |
| 2/5/7/8 (knowledge) | build embeddings (`bge-small`) → vector index; **RAG, no fine-tune** | Job |
| 9 Reporting | template + few-shot; no training | — |

**Principles:** prefer AutoTrain for standard classifiers (reproducible, no infra code); use HF Jobs for anything custom (EMBER, LogBERT, LoRA); keep **LoRA over full fine-tunes** (cheap, swappable adapters); register every run's metrics to the model card.

---

## 7. Deployment & serving workflow (HF-native)

1. **Train** on HF (AutoTrain/Jobs) → artifacts pushed to **`Che237/cyberforge-models`** (versioned by tag; one subfolder per agent + a `model_card.md` with metrics).
2. **Serve:**
   - **Small models** (sklearn/LightGBM/DistilBERT) → loaded by the existing **Docker Space** from the models repo (lazy-load on boot).
   - **Heavier transformers** (DeBERTa, LogBERT, embeddings) → **HF Inference Endpoints** (dedicated, **scale-to-zero** to control cost), or co-host on a **GPU Space** if you prefer one box.
   - **DeepSeek reasoning** → **Inference Providers** (serverless), called from the Space.
3. **Gateway:** keep the Space's REST surface as the single ML API; add `/api/v2/report` (PDF) + per-agent routes. The Heroku **backend** (`mlServiceClient.js`) routes desktop requests to the Space; the desktop continues to hit `/api/cyberforge-ml`.
4. **Promotion:** PR → eval gate (Section 9) must pass → tag model in `cyberforge-models` → Space picks up the tag → smoke test `/health` + a golden-set request.

---

## 8. Resource requirements & cost

| Need | Recommendation | Rough cost |
|---|---|---|
| Inference (detectors/BERT) | **Space CPU-upgrade** (or keep cpu-basic for dev) | free–$0.03/hr (or free w/ sleep) |
| Transformer agents (DeBERTa/LogBERT/embeddings) | **Inference Endpoints, scale-to-zero, T4/A10G** | ~$0.5–1.3/hr only while warm |
| DeepSeek reasoning | **Inference Providers (serverless)** | pay-per-token (V3.2 cheap; R1 pricier) |
| Classifier training | AutoTrain/Job **T4/A10G** | minutes–hours, a few $ per run |
| LLM LoRA | Job **A100** | hours, tens of $ per run |
| Storage | model + dataset repos on HF Hub | free up to large sizes |

**Cost-control levers:** serverless DeepSeek (no idle cost), scale-to-zero Endpoints, LoRA not full-FT, AutoTrain for the standard classifiers, batch eval.

---

## 9. Monitoring & maintenance

- **Eval harness (build first):** per-agent held-out HF test split + a `evaluate.py` Job that prints the metrics in Section 3 and writes them to the model card. **No model ships without a number.**
- **Golden sets:** a small, hand-checked request set per endpoint run on every deploy (regression gate).
- **Drift detection:** log input feature distributions + live label/score histograms from the Space; alert on shift (the desktop already polls ML health — extend it with per-model accuracy/last-eval).
- **Versioning:** model repo **tags** = releases; dataset cards record source+license; keep a `CHANGELOG`.
- **Retraining cadence:** CVE/exploit RAG corpus **weekly** refresh (Job); classifiers **quarterly** or on drift; LLM prompts/LoRAs as needed.
- **Observability surface:** the desktop **Model Inference** + **Agent Core** screens already render ML status — wire them to a `/api/v2/agents/status` that reports each agent's model version, last-eval metrics, and health.
- **Security:** all tokens in HF Secrets; no keys in code/git; dataset license compliance recorded per dataset.

---

## 10. Implementation roadmap (phased)

> Mirrors the project's existing "safe phased waves." Each phase ends with a verifiable artifact + metrics.

- **Phase 0 — Hygiene & foundations (0.5–1 wk)**
  - Rotate the leaked HF token; remove committed Gemini key; resolve the `datasets/metadata.json` merge conflict; move secrets → HF Secrets.
  - Build the **eval harness** + baseline the 4 current models on held-out HF splits (first real numbers).
- **Phase 1 — DeepSeek swap (0.5–1 wk, quick win)**
  - Replace Gemini→DeepSeek in the Space + backend; delete `google-genai`; verify `/api/v2/chat` + explanation quality on the golden set. **Ships value immediately, kills the broken dependency.**
- **Phase 2 — HF-native datasets (1 wk)**
  - Migrate every dataset to HF (Jobs), push processed splits + cards to `Che237/cyberforge-datasets`; deprecate GitHub-raw CSVs.
- **Phase 3 — Detector agents 1, 3, 4 (1.5–2 wk)**
  - Train Threat (DeBERTa/URL), Malware (EMBER LightGBM), Monitoring (CICIDS/UNSW XGBoost+IForest); calibrate FPR; ship behind the existing endpoints; record metrics.
- **Phase 4 — Knowledge/RAG agents 2, 7, 8 + memory (1.5–2 wk)**
  - Build embeddings + vector index over CVE/controls/remediation corpora; wire DeepSeek RAG; reuse the desktop vector memory; add endpoints.
- **Phase 5 — Reasoning agents 5, 6 (1.5–2 wk)**
  - Incident Response (DeepSeek-R1 + playbooks/MITRE), Log Analysis (Drain + LogBERT + summary); optional LoRAs via TRL.
- **Phase 6 — Reporting agent 9 + orchestration (1 wk)**
  - `/api/v2/report` PDF (WeasyPrint) from the structured schema; `/api/v2/agents/status`; wire the backend orchestrator + desktop Reports/Agent Core screens.
- **Phase 7 — Eval, monitoring, GPU/serving hardening (ongoing)**
  - Endpoints/scale-to-zero, drift alerts, retraining cadence, model cards, dashboards.

---

## 11. Risks & mitigations
- **Dataset license/availability:** verify each HF id + license before training; prefer permissive/benchmark sets; mirror to your repo for stability.
- **Embedding↔reality drift (scanner features):** calibrate detector thresholds on *live* scraper output, not just the training distribution.
- **DeepSeek data egress (serverless):** if a no-egress requirement exists, self-host `R1-Distill-Qwen-7B` on an Endpoint instead.
- **cpu-basic limits:** move transformers to Endpoints; keep only light models on the Space.
- **LLM hallucination in security context:** enforce RAG + citations + JSON schema + the eval gate; reporting agent must only restate inputs (no invented findings).

---

## Appendix A — exact targets to confirm on HF before Phase 2/3
- DeepSeek: `deepseek-ai/DeepSeek-V3.2`, `deepseek-ai/DeepSeek-R1`, `deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` (confirm Inference-Providers availability + pricing).
- Datasets to verify ids/licenses: EMBER (HF mirror), CICIDS2017 / UNSW-NB15 / NSL-KDD (HF mirrors), `imanoop7/phishing_url_classification`, `ealvaradob/phishing-dataset`, `pirocheto/phishing-url`, `AlicanKiraz0/Cybersecurity-Dataset-v1`, LogHub mirrors.
- Confirmed-found (search, 2026-05): `stasvinokur/cve-and-cwe-dataset-1999-2025`, `AlicanKiraz0/All-CVE-Records-Training-Dataset`, `Bouquets/Cybersecurity-LLM-CVE`, `darkknight25/Exploit_Database_Dataset`, `elftsdmr/malware-url-detect`, `kmack/malicious-url-detection`.

## Appendix B — files that change for the DeepSeek swap
- `ml-services/hf_space_deploy/app.py` (Gemini path ~1678, `genai.Client` ~121, `SECURITY_LLM_REPO` ~591)
- `ml-services/app/services/gemini_service.py` → `deepseek_service.py`
- `ml-services/requirements.txt` (drop `google-genai`)
- `backend/src/services/mlServiceClient.js` (drop Gemini path; route to Space DeepSeek)
- Space/Job **Secrets**: add `HF_TOKEN`; remove `GEMINI_API_KEY`
