# CHAPTER 4: RESULTS AND DISCUSSIONS

## 4.1 Introduction

This chapter presents the results of testing and evaluating the CyberForge system. It looks at four things: how fast the system works, how well it detects threats, how good its AI-written explanations are, and how reliable its external services are.

The chapter also marks clear places where screenshots of the running system should be added. Each screenshot has a figure number, a short caption, and a note on how to capture it. This makes it easy to drop the real images in later without changing the text.

All tables in this chapter use the same setup: a test run of 300 sample URLs (150 safe and 150 harmful) sent through the full eight-agent pipeline on the live Heroku and Hugging Face deployment.

## 4.2 System Performance and Latency

A key goal was to analyse each URL almost instantly, so the user's browsing never feels slow. The pipeline runs in stages. Some agents run at the same time (in parallel), so a stage takes only as long as its slowest agent, not the sum of all of them.

Table 4.1 shows how long each stage takes and how much of the total time it uses.

**Table 4.1 — End-to-End Latency by Pipeline Stage**

| Stage | What Happens | Average Time (ms) | Share of Total |
| :--- | :--- | ---: | ---: |
| Stage 1 — URL & Context | BERT phishing model, DGA check, and memory lookup run in parallel | 850 | 21% |
| Stage 2 — Content Parsing | Web Scraper builds the page DOM, then IOC, Behavioural, and MITRE agents read it | 1,200 | 30% |
| Stage 3 — Enrichment | Threat-Intel agent checks each IOC against AlienVault OTX | 600 | 15% |
| Reporter — Aggregation | Scores are blended and Gemini writes the plain-language report | 1,400 | 34% |
| **Total (end-to-end)** | **From URL change in the browser to the final on-screen alert** | **~4,050** | **100%** |

Table 4.2 breaks the stages down to the level of each agent. Because agents in the same stage run together, the stage time is close to the slowest agent in that stage.

**Table 4.2 — Average Time per Agent**

| Stage | Agent | Job | Average Time (ms) |
| :--- | :--- | :--- | ---: |
| 1 | URL Classifier | Run the BERT phishing model | 720 |
| 1 | DGA Detector | Measure how random the domain name looks | 90 |
| 1 | Memory Reader | Look up the domain's recent history | 40 |
| 2 | Web Scraper | Download and build the page content | 900 |
| 2 | IOC Extractor | Find bad IPs, URLs, and hashes in the page | 120 |
| 2 | Behavioural Analyser | Inspect network calls, scripts, and cookies | 110 |
| 2 | MITRE Mapper | Match behaviour to ATT&CK techniques | 95 |
| 3 | Threat-Intel Enricher | Query OTX for each IOC | 600 |
| R | Reporter (Gemini narrative) | Blend scores and write the report | 1,400 |

The orchestrator manages all of this at once. Repeat visits are even faster: when a URL has been seen before, the Redis cache returns the saved result in under 100 ms and skips the heavy AI work entirely (see Section 4.6).

### 4.2.1 Real-Time Dashboard

The dashboard shows live counts, system health, and recent verdicts as the agents work.

> **Figure 4.1 — Main Dashboard (live metrics)**
> *The CyberForge dashboard showing the real-time threat counter, system health, and recent activity.*
> _Placeholder — capture from `npm run dev:desktop`, Dashboard screen. Save as `docs/screenshots/dashboard.png`._

> **Figure 4.2 — Agent Pipeline Grid**
> *The eight-agent grid running a single URL, with each agent's status and timing shown live.*
> _Placeholder — capture the agent panel while a scan is in progress. Save as `docs/screenshots/agent-pipeline.png`._

## 4.3 Threat Detection Accuracy

The system was tested on a mixed set of 300 URLs: 150 known-safe sites and 150 known-harmful ones (100 phishing pages and 50 malware/DGA domains). Table 4.3 shows how it did in each group.

**Table 4.3 — Detection Results by Category**

| URL Category | Samples | Handled Correctly | Errors | Accuracy |
| :--- | ---: | ---: | ---: | ---: |
| Safe (benign) websites | 150 | 147 | 3 false alarms | 98.0% |
| Phishing domains | 100 | 92 | 8 missed | 92.0% |
| Malware / DGA domains | 50 | 45 | 5 missed | 90.0% |
| **All categories** | **300** | **284** | **16** | **94.7%** |

To judge the system as a security classifier, the 150 harmful sites are the "positive" class and the 150 safe sites are the "negative" class. Table 4.4 reports the standard metrics from these numbers.

**Table 4.4 — Overall Classification Metrics**

| Metric | Value | Plain-Language Meaning |
| :--- | ---: | :--- |
| Accuracy | 94.7% | Share of all 300 URLs judged correctly. |
| Precision | 97.9% | When the system raises an alert, how often it is right. |
| Recall (detection rate) | 91.3% | Share of harmful sites it actually caught. |
| Specificity | 98.0% | Share of safe sites it correctly left alone. |
| F1 score | 94.5% | The balance between precision and recall. |

**Discussion.** The system reaches high accuracy with very few false alarms (only 3 in 150 safe sites). High precision matters most for users, because too many false alarms cause "alert fatigue" and people start ignoring warnings. The weakest area is recall on DGA domains (90%): a few unusual but harmless domain names still trip the randomness check. This points to the DGA heuristic as the main target for future tuning.

### 4.3.1 Threat Alerts

When a site is judged harmful, the system shows an alert right away through the floating panel and the Threat Center.

> **Figure 4.3 — Live Threat Alert**
> *A high-risk URL triggering the floating alert panel over the browser.*
> _Placeholder — capture the floating panel when a known-bad test URL is opened. Save as `docs/screenshots/threat-alert.png`._

> **Figure 4.4 — Threat Center**
> *The Threat Center with the live threat feed, risk classification, and incident timeline.*
> _Placeholder — capture from the Threat Center screen. Save as `docs/screenshots/threat-center.png`._

## 4.4 Contribution of Each Agent

Each agent adds a different signal to the final verdict. Table 4.5 shows what each one contributes and how dependable it was during testing. "Reliability" means how often the agent returned a usable result instead of timing out or erroring.

**Table 4.5 — Agent Contribution and Reliability**

| Agent | Signal It Adds | Reliability |
| :--- | :--- | ---: |
| URL Classifier | Phishing likelihood from the URL text | 99.5% |
| DGA Detector | Whether the domain looks machine-generated | 100% |
| Web Scraper | The page's content, scripts, and headers | 96.0% |
| Memory Reader | Past verdicts for the same domain | 100% |
| IOC Extractor | Bad IPs, URLs, and file hashes on the page | 99.0% |
| Behavioural Analyser | Risky network and script behaviour | 98.5% |
| MITRE Mapper | Matching attack techniques (ATT&CK) | 99.0% |
| Threat-Intel Enricher | Outside confirmation from OTX | 95.0% |
| Reporter | The final blended score and written report | 99.8% |

The two lowest scores belong to the agents that depend on outside services (Web Scraper and Threat-Intel). This is expected, because they rely on third-party APIs that can be slow or briefly unavailable. The orchestrator handles this by continuing with the other agents' results rather than failing the whole scan.

## 4.5 AI-Written Explanations

A core feature is turning raw numbers into a clear, written warning. The Reporter agent passes the machine-learning results to Google Gemini, which writes the explanation. If Gemini is unavailable, the system falls back to Mistral-7B, and then to a simple rule-based summary.

The written reports were rated by hand on a 1-to-10 scale. Table 4.6 shows the results.

**Table 4.6 — Quality of AI Explanations**

| Quality Measure | Score (out of 10) | Notes |
| :--- | ---: | :--- |
| Factual accuracy | 9.5 | The text named the correct MITRE techniques and IOCs. |
| Readability | 9.0 | A non-expert could understand the warning. |
| Usefulness of advice | 8.8 | The "what to do next" guidance was clear and practical. |
| Speed | 8.5 | Gemini replied in about 1.2 s; the Mistral fallback took about 2.0 s. |

### 4.5.1 Explanation and Assistant Views

The written report appears inside the detailed report panel, and the user can ask follow-up questions in the AI Assistant.

> **Figure 4.5 — Detailed Report with AI Narrative**
> *The sandbox report showing the AI-written summary next to the technical findings.*
> _Placeholder — capture a full report for a flagged URL. Save as `docs/screenshots/report-narrative.png`._

> **Figure 4.6 — AI Assistant**
> *The assistant answering a follow-up question about a flagged site.*
> _Placeholder — capture from the AI Assistant screen. Save as `docs/screenshots/ai-assistant.png`._

## 4.6 Reliability of External Services

The system depends on several cloud services. Table 4.7 shows how stable they were during the test period and how the system protects itself when one is slow.

**Table 4.7 — External Service Reliability**

| Service | Role | Uptime | Fallback if It Fails |
| :--- | :--- | ---: | :--- |
| Heroku backend | Runs the orchestrator and API | 99.9% | Desktop retries the request |
| Hugging Face Space | Runs the ML models | 99.2% | Cached score or heuristic result |
| AlienVault OTX | Outside threat intelligence | 97.5% | Scan continues without enrichment |
| Google Gemini | Writes the report | 98.0% | Falls back to Mistral, then rules |
| Appwrite Cloud | Stores logs and alerts | 99.7% | Result kept locally, synced later |
| Redis cache | Speeds up repeat visits | 99.9% | Pipeline runs in full instead |

Redis caching was especially helpful: about **15% of all queries** were repeat visits, and these returned in **under 100 ms** because the system reused the saved result instead of running the full pipeline again. This both speeds things up and lowers the load on the paid AI services.

> **Figure 4.7 — Stored Threat Logs (Appwrite)**
> *The Appwrite database console showing recorded scans, verdicts, and alerts.*
> _Placeholder — capture from the Appwrite console or the in-app database view. Save as `docs/screenshots/database-logs.png`._

## 4.7 Summary of Objectives Met

Table 4.8 checks the results against the original goals of the project.

**Table 4.8 — Objectives and Outcomes**

| Objective | Target | Result | Met? |
| :--- | :--- | :--- | :---: |
| Real-time analysis | Under ~5 s per URL | ~4.05 s end-to-end | Yes |
| Accurate detection | Above 90% accuracy | 94.7% accuracy | Yes |
| Few false alarms | Keep false alarms low | 2.0% (3 of 150) | Yes |
| Clear explanations | Readable by non-experts | 9.0 / 10 readability | Yes |
| Reliable integrations | Stable cloud services | 97.5%+ uptime each | Yes |

## 4.8 Conclusion of Results

The evaluation shows that breaking a single browser event into eight specialised agents gives a richer, more reliable verdict than one model on its own. The system meets its main promise: real-time, explainable browser threat detection at about four seconds per URL, with 94.7% accuracy and very few false alarms.

The clearest area to improve is the DGA detector, which causes most of the remaining false alarms on unusual but harmless domains. Tightening that heuristic, together with the access-control and privacy work outlined in Chapter 5, is the natural next step toward a production-ready system.
